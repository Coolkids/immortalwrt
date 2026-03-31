#!/bin/bash

function main(){
case $1 in
"feed")
	echo "update feed"
	feed
	echo "update feed finish"
	;;
"build")
	build $2
	;;
"restore")
	restore_config $2
	;;
"save")
	save_config $2
	;;
*)
	echo "param invalid"
	;;
esac
}

# 版本比较函数（返回 0 表示 $1 < $2）
function version_lt() {
    local v1="$1"
    local v2="$2"

    # 按 . 分割
    IFS='.' read -ra arr1 <<< "$v1"
    IFS='.' read -ra arr2 <<< "$v2"

    local len=${#arr1[@]}
    [[ ${#arr2[@]} -gt $len ]] && len=${#arr2[@]}

    for ((i=0; i<len; i++)); do
        local n1=${arr1[i]:-0}
        local n2=${arr2[i]:-0}

        # 去掉前导0
        n1=$((10#$n1))
        n2=$((10#$n2))

        if (( n1 < n2 )); then
            return 0
        elif (( n1 > n2 )); then
            return 1
        fi
    done

    return 1
}


function feed(){
	patchs=`pwd`
	if [ -d "./tmp" ]; then
		rm -rf ./tmp
	fi
	rm -rf ./feeds/*
	./scripts/feeds update -a
	##禁用luci_app_attendedsysupgrade
	##pushd ./feeds/luci
	##git apply $patchs/patchs/0000-Revert-collections-Add-luciappattendedsysupgrade.patch
	##popd
	rm -rf ./feeds/luci/applications/luci-app-passwall
	rm -rf ./feeds/packages/net/v2ray-geodata
	rm -rf ./feeds/packages/net/mosdns
	rm -rf ./feeds/luci/applications/luci-app-unblockneteasemusic
	rm -rf ./feeds/luci/themes/luci-theme-argon
	check_xtables_addons
	# curl - http3/quic
	rm -rf feeds/packages/net/curl
	git clone https://github.com/sbwml/feeds_packages_net_curl feeds/packages/net/curl

	sed -i '/^else ifeq (\$(ARCH),x86_64)$/a\
		PKG_SOURCE:=bandix-$(RUST_BANDIX_VERSION)-x86_64-unknown-linux-musl.tar.gz' "./feeds/custom/openwrt-bandix/openwrt-bandix/Makefile"
	##sed -i 's/--set=llvm\.download-ci-llvm=true/--set=llvm.download-ci-llvm=false/' ./feeds/packages/lang/rust/Makefile
	./scripts/feeds install -a
	./scripts/feeds install -p custom -f luci-app-passwall
	./scripts/feeds install -p custom -f v2ray-geodata
	./scripts/feeds install -p custom -f mosdns
	./scripts/feeds install -p custom -f luci-theme-argon
}

function check_xtables_addons(){
	local makefile_path="./feeds/packages/net/xtables-addons/Makefile"
	if [[ -z "$makefile_path" || ! -f "$makefile_path" ]]; then
		echo "xtables-addons Makefile not exist"
		return
	fi

	local pkg_version=$(grep -E '^PKG_VERSION[:=]' "$makefile_path" | head -n1 | sed -E 's/.*[:=][[:space:]]*//')

	if [[ -z "$pkg_version" ]]; then
		echo "xtables-addons  PKG_VERSION not found"
		return
	fi

	echo "xtables-addons version: $pkg_version"
	if version_lt "$pkg_version" "3.30"; then
    	echo "xtables-addons Version < 3.30"
		patch_xtables_addons
	else
    	echo "xtables-addons Version >= 3.30, skip"
	fi
}

function patch_xtables_addons(){
	rm -rf ./feeds/packages/net/xtables-addons
	cp -r $patchs/patchs/xtables-addons ./feeds/packages/net
}

function restore_config(){
	echo "restore $1 config"
	cp ./configs/$1 .config
}

function save_config(){
	echo "save $1 config"
	cp .config ./configs/$1
}

function build(){
	feed
	restore_config $1
	make defconfig
	make download -j8
	time make -j$(($(nproc) + 1))  || make -j1 V=s
}
main $1 $2

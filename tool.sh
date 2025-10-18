#!/bin/bash

function main(){
case $1 in
"feed")
	echo "update feed"
	feed
	echo "update feed finish"
	;;
*)
	echo "param invalid"
	;;
esac
}

function smartdns(){
	WORKINGDIR="`pwd`/feeds/packages/net/smartdns"
	mkdir $WORKINGDIR -p
	rm $WORKINGDIR/* -fr
	wget https://github.com/pymumu/openwrt-smartdns/archive/master.zip -O $WORKINGDIR/master.zip
	unzip $WORKINGDIR/master.zip -d $WORKINGDIR
	mv $WORKINGDIR/openwrt-smartdns-master/* $WORKINGDIR/
	rmdir $WORKINGDIR/openwrt-smartdns-master
	rm $WORKINGDIR/master.zip

	LUCIBRANCH="master" #更换此变量
	WORKINGDIR="`pwd`/feeds/luci/applications/luci-app-smartdns"
	mkdir $WORKINGDIR -p
	rm $WORKINGDIR/* -fr
	wget https://github.com/pymumu/luci-app-smartdns/archive/${LUCIBRANCH}.zip -O $WORKINGDIR/${LUCIBRANCH}.zip
	unzip $WORKINGDIR/${LUCIBRANCH}.zip -d $WORKINGDIR
	mv $WORKINGDIR/luci-app-smartdns-${LUCIBRANCH}/* $WORKINGDIR/
	rmdir $WORKINGDIR/luci-app-smartdns-${LUCIBRANCH}
	rm $WORKINGDIR/${LUCIBRANCH}.zip
}

function delete_dep(){
# 定义A和B文件夹的路径
A_DIR="./feeds/diy1"
B_DIR="./feeds/packages/net"

# 遍历A文件夹中的子文件夹
for subdir in "$A_DIR"/*; do
    if [ -d "$subdir" ]; then
        # 提取子文件夹的名字
        subdir_name=$(basename "$subdir")
        
        # 在B文件夹中查找并删除同名的文件夹
        if [ -d "$B_DIR/$subdir_name" ]; then
            rm -rf "$B_DIR/$subdir_name"
            echo "Deleted $B_DIR/$subdir_name"
        fi
    fi
done
}

function install_dep(){
# 定义A和B文件夹的路径
A_DIR="./feeds/diy1"

# 遍历A文件夹中的子文件夹
for subdir in "$A_DIR"/*; do
    if [ -d "$subdir" ]; then
        # 提取子文件夹的名字
        subdir_name=$(basename "$subdir")
        ./scripts/feeds install -p diy1 -f "$subdir_name"
        echo "install $subdir_name"
    fi
done
}

function feed(){
patchs=`pwd`
rm -rf ./feeds/*
./scripts/feeds update -a
delete_dep
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/packages/net/v2ray-geodata
rm -rf ./feeds/packages/net/mosdns

cp $patchs/patchs/rust/Makefile ./feeds/packages/lang/rust/Makefile
# curl - http3/quic
rm -rf feeds/packages/net/curl
git clone https://github.com/sbwml/feeds_packages_net_curl feeds/packages/net/curl
#smartdns  使用稳定版本
rm -rf ./feeds/packages/net/smartdns
rm -rf ./feeds/luci/applications/luci-app-smartdns
smartdns
./scripts/feeds install -a

# Set Rust build arg llvm.download-ci-llvm to false.
sed -i 's/--set=llvm\.download-ci-llvm=true/--set=llvm.download-ci-llvm=false/' ./feeds/packages/lang/rust/Makefile

./scripts/feeds install -p diy2 -f luci-app-passwall
./scripts/feeds install -p custom -f v2ray-geodata
./scripts/feeds install -p mosdns -f mosdns
install_dep
pushd ./feeds/luci
git apply $patchs/patchs/001-luci-status-network-ifaces.patch
popd
##rm -rf ./feeds/packages.tmp
##./scripts/feeds update -i
}


main $1

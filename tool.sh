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

## patch curl quic
rm -rf ./feeds/packages/libs/nghttp2
rm -rf ./feeds/packages/libs/nghttp3
rm -rf ./feeds/packages/libs/ngtcp2
cp -r $patchs/patchs/nghttp2 ./feeds/packages/libs
cp -r $patchs/patchs/nghttp3 ./feeds/packages/libs
cp -r $patchs/patchs/ngtcp2 ./feeds/packages/libs
# curl - http3/quic
rm -rf feeds/packages/net/curl
git clone https://github.com/sbwml/feeds_packages_net_curl feeds/packages/net/curl

./scripts/feeds install -a
# Set Rust build arg llvm.download-ci-llvm to false.
sed -i 's/--set=llvm\.download-ci-llvm=true/--set=llvm.download-ci-llvm=false/' ./feeds/packages/lang/rust/Makefile


## 兼容passwall passwall2 同时安装的APK编译
sed -i '/\/www\/luci-static\/resources\/qrcode.min.js/d' ./feeds/passwall2/luci-app-passwall2/Makefile
rm -rf ./feeds/passwall2/luci-app-passwall2/htdocs/luci-static/resources/qrcode.min.js
./scripts/feeds install -p diy2 -f luci-app-passwall
./scripts/feeds install -p custom -f v2ray-geodata
./scripts/feeds install -p mosdns -f mosdns
install_dep
pushd ./feeds/luci
git apply $patchs/patchs/001-luci-status-network-ifaces.patch
popd
}


main $1

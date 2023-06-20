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

function feed(){
rm -rf ./feeds/*
./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall
./scripts/feeds install -a
./scripts/feeds install -p diy2 luci-app-passwall
cd ./feeds/luci
git apply ../../.github/patch/001-luci-status-network-ifaces.patch
}

main $1
#!/bin/bash
corpid=`echo -n $1`
corpsecret=`echo -n $2`
agentid=`echo -n $3`
arch=`echo -n $4`
release=`echo -n $5`
da=`date "+%Y-%m-%d %H:%M:%S"`
ms="固件类型: $arch\nRELEASE NAME: $release"
url="https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=$(curl -s "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=$corpid&corpsecret=$corpsecret"|/usr/bin/jq '.access_token'|sed 's/"//g')"

msjson='{
	"touser": "@all",
	"msgtype": "news",
	"agentid": "'${agentid}'",
	"news":{
		"articles":[
			{
				"title":"Github Actions固件编译完成 时间:'${da}'",
				"description" :"'${ms}'",
				"picurl":"https://raw.githubusercontent.com/Coolkids/immortalwrt/master/.github/banner.jpg"
			}
		]
	},
	"safe":0
}'
curl -X POST "${url}" -H 'Content-Type: application/json' -d "${msjson}" >/dev/null 2>&1




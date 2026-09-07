'use strict';

'require fs';
'require rpc';
'require uci';

var callInit = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

function classes(type) {
	var result = [];

	uci.sections('qos_gargoyle', type, function(section) {
		result.push({
			id: section['.name'],
			name: section.name || section['.name']
		});
	});

	return result;
}

function nextSectionName(type, prefix) {
	var max = 0;

	uci.sections('qos_gargoyle', type, function(section) {
		var match = String(section['.name'] || '').match(new RegExp('^' + prefix + '_(\\d+)$'));
		if (match)
			max = Math.max(max, +match[1]);
	});

	return prefix + '_' + (max + 1);
}

function hostOptions(hosts) {
	var addresses = {};

	Object.keys(hosts || {}).forEach(function(mac) {
		var host = hosts[mac] || {};
		L.toArray(host.ipaddrs || host.ipv4).forEach(function(ip) {
			addresses[ip] = mac;
		});
		L.toArray(host.ip6addrs || host.ipv6).forEach(function(ip) {
			addresses[ip] = mac;
		});
	});

	return L.sortedKeys(addresses, null, 'addr').map(function(ip) {
		return { value: ip, label: '%s (%s)'.format(ip, addresses[ip]) };
	});
}

function classLabel(id) {
	if (!id)
		return '';

	var section = uci.get('qos_gargoyle', id);
	return section && section.name ? section.name : id;
}

function formatBytes(value) {
	var number = +value;
	if (!isFinite(number) || number <= 0)
		return _('Not set');
	if (number < 1024)
		return '%d B'.format(number);
	if (number < 1048576)
		return '%.1f KiB'.format(number / 1024);
	return '%.1f MiB'.format(number / 1048576);
}

function parseTcRates(text) {
	var result = [];
	var lines = String(text || '').split(/\n/);
	var now = Date.now();

	for (var i = 0; i < lines.length; i++) {
		var match = lines[i].match(/class\s+hfsc\s+1:(\d+).*?\n?\s+Sent\s+(\d+)/);
		if (match)
			result.push({ classid: +match[1], bytes: +match[2], timestamp: now });
	}

	return result;
}

function rateText(current, previous) {
	if (!current || !previous || current.bytes < previous.bytes)
		return '*';

	var elapsed = current.timestamp - previous.timestamp;
	if (elapsed <= 0)
		return '*';

	var kbps = (current.bytes - previous.bytes) * 8 / elapsed;
	return kbps < 1 ? kbps.toFixed(1) : Math.round(kbps).toString();
}

function serviceAction(action) {
	return callInit('qos_gargoyle', action);
}

return {
	callHostHints: callHostHints,
	classes: classes,
	nextSectionName: nextSectionName,
	hostOptions: hostOptions,
	classLabel: classLabel,
	formatBytes: formatBytes,
	parseTcRates: parseTcRates,
	rateText: rateText,
	serviceAction: serviceAction
};

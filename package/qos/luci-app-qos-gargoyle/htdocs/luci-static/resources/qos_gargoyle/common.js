'use strict';

'require baseclass';
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

function parseSize(value, units, defaultUnit) {
	var input = String(value == null ? '' : value).trim();
	var match = input.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]*)$/);
	if (!match || !match[1])
		return null;

	/* Size units are deliberately case-insensitive (b, B, kb, KB, etc.). */
	var unit = String(match[2] || defaultUnit || '').toUpperCase();
	var multiplier = units && units[unit];
	var number = +match[1];
	if (!multiplier || !isFinite(number) || number < 0)
		return null;

	return Math.round(number * multiplier);
}

/*
 * QoS stores link speeds as integer kbit/s values.  Keep the UCI format
 * unchanged, but allow the UI to use the units people normally use when
 * reading a speed test result (for example, 20m or 512 kbps).  The UI uses
 * 1024 kbps as 1 mbps to match the QoS backend's binary conversion.
 */
function parseBandwidth(value) {
	var input = String(value == null ? '' : value).trim();
	var match = input.match(/^([0-9]+(?:\.[0-9]+)?)\s*(m(?:bps)?|k(?:bps)?)?$/i);
	if (!match)
		return null;

	var number = +match[1];
	if (!isFinite(number) || number < 0)
		return null;

	var unit = (match[2] || 'k').toLowerCase();
	var multiplier = unit.charAt(0) === 'm' ? 1024 : 1;
	return Math.round(number * multiplier);
}

function formatBandwidth(value) {
	var input = String(value == null ? '' : value).trim();
	if (!input)
		return '';

	var kbps = +input;
	if (!isFinite(kbps) || kbps < 0)
		return '';

	if (kbps >= 1024) {
		var mbps = kbps / 1024;
		var decimals = mbps < 10 && mbps % 1 ? 2 : 1;
		var text = mbps.toFixed(decimals).replace(/\.?0+$/, '');
		return '%s mbps'.format(text);
	}

	return kbps > 0 && kbps < 1 ? '%.1f kbps'.format(kbps) :
		'%d kbps'.format(Math.round(kbps));
}

function parseTcRates(text) {
	var result = [];
	var output = String(text || '');
	var pattern = /class\s+hfsc\s+1:(\d+)[\s\S]*?\n\s+Sent\s+(\d+)/g;
	var now = Date.now();
	var match;

	while ((match = pattern.exec(output)) != null)
		result.push({ classid: +match[1], bytes: +match[2], timestamp: now });

	return result;
}

function rateText(current, previous) {
	if (!current || !previous || current.bytes < previous.bytes)
		return '*';

	var elapsed = current.timestamp - previous.timestamp;
	if (elapsed <= 0)
		return '*';

	var kbps = (current.bytes - previous.bytes) * 8 / elapsed;
	return formatBandwidth(kbps);
}

function serviceAction(action) {
	return callInit('qos_gargoyle', action);
}

return baseclass.extend({
	callHostHints: callHostHints,
	classes: classes,
	nextSectionName: nextSectionName,
	hostOptions: hostOptions,
	classLabel: classLabel,
	formatBytes: formatBytes,
	parseSize: parseSize,
	parseBandwidth: parseBandwidth,
	formatBandwidth: formatBandwidth,
	parseTcRates: parseTcRates,
	rateText: rateText,
	serviceAction: serviceAction
});

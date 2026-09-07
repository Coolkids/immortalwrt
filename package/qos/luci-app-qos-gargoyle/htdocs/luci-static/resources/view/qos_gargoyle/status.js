'use strict';

'require view';
'require fs';
'require poll';
'require uci';
'require network';
'require qos_gargoyle.common as qos';

function preformatted(title, value) {
	return E('fieldset', { 'class': 'cbi-section' }, [
		E('legend', {}, title),
		E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere' }, value || _('No data found'))
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qos_gargoyle'),
			fs.exec('/etc/init.d/qos_gargoyle', [ 'enabled' ]).catch(function() { return { code: 1 }; }),
			fs.exec('/etc/init.d/qos_gargoyle', [ 'show' ]).catch(function() { return { stdout: '' }; }),
			fs.read('/tmp/qosmon.status').catch(function() { return ''; }),
			network.load().catch(function() { return null; })
		]);
	},

	render: function(data) {
		var root = E('div', { 'class': 'cbi-map' });
		var enabled = data[1] && data[1].code === 0;
		var show = (data[2] && data[2].stdout) || _('No data found');
		var monitor = data[3] || _('Active congestion control is not enabled');
		var status = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Gargoyle QoS status')),
			E('p', {}, enabled ? _('The service is enabled at boot.') : _('The service is disabled at boot.'))
		]);
		var rates = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Live class load')),
			E('p', { 'id': 'qos-gargoyle-rates' }, _('Collecting data...'))
		]);

		root.appendChild(status);
		root.appendChild(rates);
		root.appendChild(preformatted(_('Current QoS configuration'), show));
		root.appendChild(preformatted(_('Active congestion control'), monitor));

		var previous = { upload: null, download: null };
		var wanDevice = 'wan';
		var wanNetwork = network.getNetwork('wan');
		if (wanNetwork) {
			var l3 = wanNetwork.getL3Device();
			if (l3)
				wanDevice = l3.getName();
		}

		var update = function() {
			return Promise.all([
				fs.exec('/usr/sbin/tc', [ '-s', 'class', 'show', 'dev', wanDevice ]).catch(function() { return { stdout: '' }; }),
				fs.exec('/usr/sbin/tc', [ '-s', 'class', 'show', 'dev', 'ifb0' ]).catch(function() { return { stdout: '' }; })
			]).then(function(result) {
				var up = qos.parseTcRates(result[0].stdout);
				var down = qos.parseTcRates(result[1].stdout);
				var rows = [];
				[ [ _('Upload'), up, previous.upload ], [ _('Download'), down, previous.download ] ].forEach(function(item) {
					item[1].forEach(function(current) {
						var old = (item[2] || []).filter(function(value) { return value.classid === current.classid; })[0];
						rows.push(E('tr', {}, [ E('td', {}, item[0]), E('td', {}, '1:%d'.format(current.classid)), E('td', {}, qos.rateText(current, old) + ' kbit/s') ]));
					});
				});
				previous.upload = up;
				previous.download = down;
				rates.replaceChildren(E('table', { 'class': 'table' }, [
					E('tr', {}, [ E('th', {}, _('Direction')), E('th', {}, _('Class')), E('th', {}, _('Rate')) ]),
					rows.length ? rows : E('tr', {}, E('td', { 'colspan': '3' }, _('No active traffic classes found.')))
				]));
			}).catch(function() {
				rates.querySelector('p').textContent = _('Unable to read traffic statistics.');
			});
		};

		poll.add(update, 3);
		return root;
	}
});

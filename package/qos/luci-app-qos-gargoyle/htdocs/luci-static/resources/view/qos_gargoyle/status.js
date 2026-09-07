'use strict';

'require view';
'require fs';
'require poll';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qos_gargoyle'),
			fs.exec('/etc/init.d/qos_gargoyle', [ 'show' ]).catch(function() { return { stdout: '' }; }),
			fs.read('/tmp/qosmon.status').catch(function() { return ''; })
		]);
	},

	render: function(data) {
		var output = E('pre');
		var loading = E('div', { 'class': 'description' }, [ _('Loading'), ' ', _('Collecting data...') ]);
		var hasData = function(value) {
			return String(value || '').trim() !== '';
		};
		var setLoading = function(show) {
			loading.style.display = show ? '' : 'none';
		};
		var update = function() {
			return Promise.all([
				fs.exec('/etc/init.d/qos_gargoyle', [ 'show' ]),
				uci.load('qos_gargoyle').then(function() {
					var enabled = uci.get('qos_gargoyle', 'download', 'qos_monenabled') || 'false';
					return enabled === 'true' ? fs.read('/tmp/qosmon.status') : Promise.resolve(_("'Active Congestion Control' not enabled"));
				})
			]).then(function(result) {
				var showOutput = result[0] && result[0].stdout || '';
				var monitorOutput = result[1] || '';
				setLoading(!hasData(showOutput) && !hasData(monitorOutput));
				var show = showOutput || _('No data found');
				var monitor = monitorOutput || _('No data found');
				output.textContent = 'Output of "/etc/init.d/qos_gargoyle show" :\n\n' +
					show + '\n\nOutput of "cat /tmp/qosmon.status" :\n\n' + monitor;
			}).catch(function() {
				setLoading(false);
				output.textContent = _('Error collecting troubleshooting information');
			});
		};

		var root = E('fieldset', { 'class': 'cbi-section' }, [
			E('legend', {}, _('Troubleshooting Data')),
			loading,
			output
		]);

		var initialShow = data[1] && data[1].stdout || '';
		var initialMonitor = data[2] || '';
		setLoading(!hasData(initialShow) && !hasData(initialMonitor));
		output.textContent = 'Output of "/etc/init.d/qos_gargoyle show" :\n\n' +
			(initialShow || _('No data found')) +
			'\n\nOutput of "cat /tmp/qosmon.status" :\n\n' +
			(initialMonitor || _('No data found'));
		poll.add(update, 15);
		return root;
	}
});

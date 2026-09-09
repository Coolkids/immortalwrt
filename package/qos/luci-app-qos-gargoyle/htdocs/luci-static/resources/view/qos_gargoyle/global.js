'use strict';

'require view';
'require form';
'require fs';
'require ui';
'require uci';
'require qos_gargoyle.common as qos';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('qos_gargoyle'),
			fs.exec('/etc/init.d/qos_gargoyle', [ 'enabled' ]).catch(function() { return { code: 1 }; })
		]);
	},

	render: function(data) {
		var enabled = uci.get_bool('qos_gargoyle', 'global', 'enable');
		var serviceEnabled = data[1] && data[1].code === 0;
		this.qosServiceEnabled = serviceEnabled;
		var m = new form.Map('qos_gargoyle', _('Gargoyle QoS'),
			_('Quality of Service (QoS) provides a way to control how available bandwidth is allocated.'));
		var s, o;

		s = m.section(form.NamedSection, 'global', 'global', _('Global Settings'));
		s.anonymous = true;

		o = s.option(form.Button, 'enable', _('QoS Switch'));
		o.inputtitle = enabled ? _('Disable QoS') : _('Enable QoS');
		o.inputstyle = enabled ? 'reset' : 'apply';
		o.onclick = function() {
			var nextEnabled = !enabled;
			var action = enabled ? 'stop' : 'start';
			var runInitAction = function(name) {
				return fs.exec('/etc/init.d/qos_gargoyle', [ name ]).then(function(reply) {
					if (reply && reply.code !== 0)
						throw new Error('qos_gargoyle %s failed (code %d)'.format(name, reply.code));
					return reply;
				});
			};

			uci.set('qos_gargoyle', 'global', 'enable', nextEnabled ? 'true' : 'false');
			return uci.save().then(function() {
				return uci.apply().catch(function(error) {
					if (error && /ubus code 5/.test(String(error.message || '')))
						return;
					throw error;
				});
			}).then(function() {
				return runInitAction(action);
			}).then(function() {
				location.reload();
			});
		};

		s = m.section(form.NamedSection, 'upload', 'upload', _('Upload Settings'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'default_class', _('Default Service Class'),
			_('Specifie how packets that do not match any rule should be classified.'));
		qos.classes('upload_class').forEach(function(item) {
			o.value(item.id, item.name);
		});

		o = s.option(form.Value, 'total_bandwidth', _('Total Upload Bandwidth'),
			_('Should be set to around 98% of your available upload bandwidth. Entering a <br />number which is too high will result in QoS not meeting its class <br />requirements. Entering a number which is too low will needlessly penalize <br />your upload speed. You should use a speed test program (with QoS off) to <br />determine available upload bandwidth. Enter the bandwidth in Mbps or kbps <br />(for example, 20m or 512k); a value without a unit is treated as kbps. <br />Leave blank to disable upload QoS.'));
		o.cfgvalue = function(section_id) {
			return qos.formatBandwidth(uci.get('qos_gargoyle', section_id, 'total_bandwidth'));
		};
		o.validate = function(section_id, value) {
			return !String(value || '').trim() || qos.parseBandwidth(value) != null ||
				_('Enter a valid bandwidth such as 20m or 512k.');
		};
		o.write = function(section_id, value) {
			var bandwidth = qos.parseBandwidth(value);
			if (bandwidth == null)
				uci.unset('qos_gargoyle', section_id, 'total_bandwidth');
			else
				uci.set('qos_gargoyle', section_id, 'total_bandwidth', String(bandwidth));
		};

		s = m.section(form.NamedSection, 'download', 'download', _('Download Settings'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'default_class', _('Default Service Class'),
			_('Specifie how packets that do not match any rule should be classified.'));
		qos.classes('download_class').forEach(function(item) {
			o.value(item.id, item.name);
		});

		o = s.option(form.Value, 'total_bandwidth', _('Total Download Bandwidth'),
			_('Specifying correctly is crucial to making QoS work. Enter the bandwidth in <br />Mbps or kbps (for example, 20m or 512k); a value without a unit is treated as <br />kbps. Leave blank to disable download QoS.'));
		o.cfgvalue = function(section_id) {
			return qos.formatBandwidth(uci.get('qos_gargoyle', section_id, 'total_bandwidth'));
		};
		o.validate = function(section_id, value) {
			return !String(value || '').trim() || qos.parseBandwidth(value) != null ||
				_('Enter a valid bandwidth such as 20m or 512k.');
		};
		o.write = function(section_id, value) {
			var bandwidth = qos.parseBandwidth(value);
			if (bandwidth == null)
				uci.unset('qos_gargoyle', section_id, 'total_bandwidth');
			else
				uci.set('qos_gargoyle', section_id, 'total_bandwidth', String(bandwidth));
		};

		o = s.option(form.Flag, 'qos_monenabled', _('Enable Active Congestion Control'),
			_('<p>The active congestion control (ACC) observes your download activity and <br />automatically adjusts your download link limit to maintain proper QoS <br />performance. ACC automatically compensates for changes in your ISP\'s <br />download speed and the demand from your network adjusting the link speed to <br />the highest speed possible which will maintain proper QoS function. The <br />effective range of this control is between 15% and 100% of the total <br />download bandwidth you entered above.</p>') +
			_('<p>While ACC does not adjust your upload link speed you must enable and <br />properly configure your upload QoS for it to function properly.</p>'));
		o.enabled = 'true';
		o.disabled = 'false';

		o = s.option(form.Value, 'ptarget_ip', _('Use Non-standard Ping Target'),
			_('The segment of network between your router and the ping target is where <br />congestion is controlled. By monitoring the round trip ping times to the <br />target congestion is detected. By default ACC uses your WAN gateway as the <br />ping target. If you know that congestion on your link will occur in a <br />different segment then you can enter an alternate ping target. Leave empty <br />to use the default settings.'));
		o.depends('qos_monenabled', 'true');
		o.value('223.5.5.5');
		o.datatype = 'ipaddr';

		o = s.option(form.Value, 'pinglimit', _('Manual Ping Limit'),
			_('Round trip ping times are compared against the ping limits. ACC controls the <br />link limit to maintain ping times under the appropriate limit. By default <br />ACC attempts to automatically select appropriate target ping limits for you <br />based on the link speeds you entered and the performance of your link it <br />measures during initialization. You cannot change the target ping time for <br />the minRTT mode but by entering a manual time you can control the target <br />ping time of the active mode. The time you enter becomes the increase in the <br />target ping time between minRTT and active mode. Leave empty to use the <br />default settings.'));
		o.depends('qos_monenabled', 'true');
		o.value('Auto', _('Auto'));
		o.datatype = "or('Auto', range(10, 250))";

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var restart = null;
		var timeout = null;
		if (this.qosServiceEnabled) {
			restart = function() {
				if (timeout)
					window.clearTimeout(timeout);
				document.removeEventListener('uci-applied', restart);
				fs.exec('/etc/init.d/qos_gargoyle', [ 'reload' ]).catch(function() {
					return qos.serviceAction('restart');
				});
			};
			document.addEventListener('uci-applied', restart);
			timeout = window.setTimeout(function() {
				document.removeEventListener('uci-applied', restart);
			}, 30000);
		}

		return this.handleSave(ev).then(function() {
			ui.changes.apply(mode == '0');
		}).catch(function(error) {
			if (restart) {
				if (timeout)
					window.clearTimeout(timeout);
				document.removeEventListener('uci-applied', restart);
			}
			throw error;
		});
	}
});

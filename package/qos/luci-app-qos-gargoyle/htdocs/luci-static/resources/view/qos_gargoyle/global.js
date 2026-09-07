'use strict';

'require view';
'require form';
'require fs';
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
		var enabled = data[1] && data[1].code === 0;
		var m = new form.Map('qos_gargoyle', _('Gargoyle QoS'),
			_('Quality of Service (QoS) controls how available bandwidth is allocated.'));
		var s, o;

		s = m.section(form.NamedSection, 'global', 'global', _('Service'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Startup status'));
		o.cfgvalue = function() {
			return enabled ? _('Enabled at boot') : _('Disabled at boot');
		};

		o = s.option(form.Button, '_toggle', _('Service control'));
		o.inputtitle = enabled ? _('Disable QoS') : _('Enable QoS');
		o.inputstyle = enabled ? 'reset' : 'apply';
		o.onclick = function() {
			uci.set('qos_gargoyle', 'global', 'enable', enabled ? 'false' : 'true');
			return uci.save().then(function() {
				return qos.serviceAction(enabled ? 'stop' : 'enable');
			}).then(function() {
				return qos.serviceAction(enabled ? 'disable' : 'start');
			}).then(function() {
				location.reload();
			});
		};

		o = s.option(form.ListValue, 'wan', _('WAN interface'),
			_('The current qos-gargoyle backend uses the logical network named “wan”.'));
		o.value('wan', _('wan (backend default)'));
		o.default = 'wan';
		o.rmempty = false;
		o.readonly = true;

		s = m.section(form.NamedSection, 'upload', 'upload', _('Upload settings'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'default_class', _('Default service class'));
		qos.classes('upload_class').forEach(function(item) {
			o.value(item.id, item.name);
		});

		o = s.option(form.Value, 'total_bandwidth', _('Total upload bandwidth (kbit/s)'),
			_('Leave empty to disable upload QoS.'));
		o.datatype = 'uinteger';

		s = m.section(form.NamedSection, 'download', 'download', _('Download settings'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'default_class', _('Default service class'));
		qos.classes('download_class').forEach(function(item) {
			o.value(item.id, item.name);
		});

		o = s.option(form.Value, 'total_bandwidth', _('Total download bandwidth (kbit/s)'),
			_('Leave empty to disable download QoS.'));
		o.datatype = 'uinteger';

		o = s.option(form.Flag, 'qos_monenabled', _('Enable active congestion control'),
			_('ACC requires both upload and download QoS to be enabled.'));
		o.enabled = 'true';
		o.disabled = 'false';

		o = s.option(form.Value, 'ptarget_ip', _('Ping target'),
			_('Leave empty to use the automatically detected WAN gateway.'));
		o.depends('qos_monenabled', 'true');
		o.datatype = 'ipaddr';

		o = s.option(form.Value, 'pinglimit', _('Manual ping limit'),
			_('Use Auto or a value between 10 and 250 milliseconds.'));
		o.depends('qos_monenabled', 'true');
		o.value('Auto', _('Auto'));
		o.datatype = "or('Auto', range(10, 250))";

		return m.render();
	}
});

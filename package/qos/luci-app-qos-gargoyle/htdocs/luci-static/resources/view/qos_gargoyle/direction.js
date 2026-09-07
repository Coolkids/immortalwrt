'use strict';

'require view';
'require form';
'require fs';
'require uci';
'require rpc';
'require tools.widgets as widgets';
'require qos_gargoyle.common as qos';

function addClassOptions(option, type) {
	qos.classes(type).forEach(function(item) {
		option.value(item.id, item.name);
	});
}

function addHostOptions(option, hosts) {
	option.value('', _('All'));
	qos.hostOptions(hosts).forEach(function(item) {
		option.value(item.value, item.label);
	});
}

function addClassSection(m, direction) {
	var type = direction + '_class';
	var s = m.section(form.GridSection, type, _('Service classes'));
	s.anonymous = true;
	s.addremove = true;
	s.sortable = false;
	s.cloneable = false;
	s.handleRemove = function(section_id, ev) {
		var defaultClass = uci.get('qos_gargoyle', direction, 'default_class');
		var referenced = defaultClass === section_id;
		uci.sections('qos_gargoyle', direction + '_rule', function(rule) {
			if (uci.get('qos_gargoyle', rule['.name'], 'class') === section_id)
				referenced = true;
		});

		if (referenced) {
			alert(_('This class is still used by a default class or classification rule.'));
			return Promise.resolve();
		}

		return this.super('handleRemove', [ section_id, ev ]);
	};
	s.handleAdd = function() {
		var id = uci.add('qos_gargoyle', type, qos.nextSectionName(type, type));
		m.addedSection = id;
		this.renderMoreOptionsModal(id);
	};
	s.sectiontitle = function(id) {
		return uci.get('qos_gargoyle', id, 'name') || _('Unnamed class');
	};

	var o = s.option(form.DummyValue, '_name', _('Class name'));
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'name') || _('Unnamed');
	};

	o = s.option(form.DummyValue, '_percent', _('Capacity share'));
	o.textvalue = function(id) {
		var value = +uci.get('qos_gargoyle', id, 'percent_bandwidth');
		return value > 0 ? '%d %%'.format(value) : _('Not set');
	};

	o = s.option(form.DummyValue, '_min', _('Minimum (kbit/s)'));
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'min_bandwidth') || '0';
	};

	o = s.option(form.DummyValue, '_max', _('Maximum (kbit/s)'));
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'max_bandwidth') || _('Unlimited');
	};

	o = s.option(form.Value, 'name', _('Class name'));
	o.modalonly = true;
	o.rmempty = false;

	o = s.option(form.Value, 'percent_bandwidth', _('Percent bandwidth at capacity'));
	o.modalonly = true;
	o.datatype = 'range(1, 100)';
	o.rmempty = false;

	o = s.option(form.Value, 'min_bandwidth', _('Minimum bandwidth (kbit/s)'));
	o.modalonly = true;
	o.datatype = 'uinteger';
	o.default = '0';

	o = s.option(form.Value, 'max_bandwidth', _('Maximum bandwidth (kbit/s)'));
	o.modalonly = true;
	o.datatype = 'uinteger';
	o.placeholder = _('Unlimited');
	o.validate = function(section_id, value) {
		var min = +uci.get('qos_gargoyle', section_id, 'min_bandwidth') || 0;
		return !value || +value >= min || _('Maximum bandwidth must be greater than or equal to the minimum bandwidth.');
	};

	if (direction === 'download') {
		o = s.option(form.Flag, 'minRTT', _('Minimize RTT'));
		o.modalonly = true;
		o.enabled = 'Yes';
		o.disabled = 'No';
	}

	return s;
}

function addRuleSection(m, direction, hosts, ndpi) {
	var type = direction + '_rule';
	var classType = direction + '_class';
	var s = m.section(form.GridSection, type, _('Classification rules'),
		_('Rules are evaluated by priority. The first matching rule is applied.'));
	s.anonymous = true;
	s.addremove = true;
	s.sortable = true;
	s.filterrow = true;
	var normalizeOrder = function() {
		var order = 10;
		uci.sections('qos_gargoyle', type, function(section) {
			uci.set('qos_gargoyle', section['.name'], 'test_order', String(order));
			order += 10;
		});
	};
	[ 'handleDrop', 'handleTouchEnd', 'handleSort' ].forEach(function(method) {
		var inherited = s[method];
		if (typeof inherited === 'function') {
			s[method] = function() {
				var result = inherited.apply(this, arguments);
				normalizeOrder();
				return result;
			};
		}
	});
	s.handleAdd = function() {
		var id = uci.add('qos_gargoyle', type, qos.nextSectionName(type, type));
		uci.set('qos_gargoyle', id, 'test_order', String((uci.sections('qos_gargoyle', type).length) * 10));
		uci.set('qos_gargoyle', id, 'family', 'any');
		m.addedSection = id;
		this.renderMoreOptionsModal(id);
	};
	s.sectiontitle = function(id) {
		return _('Rule %s').format(uci.get('qos_gargoyle', id, 'test_order') || '?');
	};

	var o = s.option(form.DummyValue, '_match', _('Match'));
	o.textvalue = function(id) {
		var fields = [];
		var proto = uci.get('qos_gargoyle', id, 'proto');
		var source = uci.get('qos_gargoyle', id, 'source');
		var destination = uci.get('qos_gargoyle', id, 'destination');
		var ports = uci.get('qos_gargoyle', id, 'srcport') || uci.get('qos_gargoyle', id, 'dstport');
		if (proto) fields.push(proto.toUpperCase());
		if (source) fields.push(_('from %s').format(source));
		if (destination) fields.push(_('to %s').format(destination));
		if (ports) fields.push(_('port %s').format(ports));
		return fields.length ? fields.join(' ') : _('All traffic');
	};

	o = s.option(form.DummyValue, '_class', _('Service class'));
	o.textvalue = function(id) {
		return qos.classLabel(uci.get('qos_gargoyle', id, 'class')) || _('Not set');
	};

	o = s.option(form.DummyValue, '_priority', _('Priority'));
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'test_order') || _('Not set');
	};

	o = s.option(form.ListValue, 'class', _('Service class'));
	o.modalonly = true;
	addClassOptions(o, classType);
	o.rmempty = false;

	o = s.option(form.ListValue, 'proto', _('Transport protocol'));
	o.modalonly = true;
	o.value('', _('All'));
	[ 'tcp', 'udp', 'icmp', 'gre' ].forEach(function(value) { o.value(value, value.toUpperCase()); });

	o = s.option(form.ListValue, 'family', _('Address family'));
	o.modalonly = true;
	o.value('any', _('All'));
	o.value('ipv4', 'IPv4');
	o.value('ipv6', 'IPv6');
	o.default = 'any';

	o = s.option(form.Value, 'source', _('Source IP(s)'));
	o.modalonly = true;
	addHostOptions(o, hosts);
	o.datatype = 'or(ipmask4, ipmask6)';

	o = s.option(form.Value, 'srcport', _('Source port(s)'));
	o.modalonly = true;
	o.datatype = 'or(port, portrange)';

	o = s.option(form.Value, 'destination', _('Destination IP(s)'));
	o.modalonly = true;
	addHostOptions(o, hosts);
	o.datatype = 'or(ipmask4, ipmask6)';

	o = s.option(form.Value, 'dstport', _('Destination port(s)'));
	o.modalonly = true;
	o.datatype = 'or(port, portrange)';

	o = s.option(form.Value, 'min_pkt_size', _('Minimum packet length'));
	o.modalonly = true;
	o.datatype = 'range(1, 1500)';

	o = s.option(form.Value, 'max_pkt_size', _('Maximum packet length'));
	o.modalonly = true;
	o.datatype = 'range(1, 1500)';
	o.validate = function(section_id, value) {
		var min = +uci.get('qos_gargoyle', section_id, 'min_pkt_size') || 0;
		return !value || +value >= min || _('Maximum packet length must be greater than or equal to the minimum packet length.');
	};

	o = s.option(form.Value, 'connbytes_kb', _('Connection bytes reached'));
	o.modalonly = true;
	o.datatype = 'range(0, 4194303)';

	if (ndpi) {
		o = s.option(form.Value, 'ndpi', _('DPI protocol'));
		o.modalonly = true;
		o.placeholder = _('All');
	}

	o = s.option(form.Value, 'test_order', _('Priority'));
	o.modalonly = true;
	o.datatype = 'range(0, 4194303)';
	o.default = '0';

	return s;
}

return function(direction) {
	return view.extend({
		load: function() {
			return Promise.all([
				uci.load('qos_gargoyle'),
				qos.callHostHints().catch(function() { return {}; }),
				fs.read('/proc/modules').catch(function() { return ''; }),
				fs.exec('/usr/sbin/iptables', [ '-m', 'ndpi', '--help' ]).catch(function() { return { stdout: '' }; })
			]);
		},

		render: function(data) {
			var m = new form.Map('qos_gargoyle', direction === 'upload' ? _('Upload QoS') : _('Download QoS'));
			var modules = data[2] || '';
			var ndpi = /(^|\n)xt_ndpi\s/.test(modules) || /ndpi/i.test((data[3] || {}).stdout || '');
			addClassSection(m, direction);
			addRuleSection(m, direction, data[1] || {}, ndpi);
			return m.render();
		}
	});
};

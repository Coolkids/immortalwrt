'use strict';

'require baseclass';
'require view';
'require form';
'require fs';
'require poll';
'require network';
'require ui';
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

function addDpiOptions(option, output) {
	option.value('', _('All'));
	String(output || '').split('\n').forEach(function(line) {
		var match = line.match(/^--([^\s]+)\s+Match for\s+([^\s]+)/);
		if (match)
			option.value(match[1], match[2]);
	});
}

function minimizeRttDescription() {
	return _('Indicates to the active congestion controller that you wish to minimize <br />round trip times (RTT) when this class is active. Use this setting for <br />online gaming or VoIP applications that need low round trip times (ping <br />times). Minimizing RTT comes at the expense of efficient WAN throughput so <br />while these class are active your WAN throughput will decline (usually <br />around 20%).');
}

function addMinimizeRttTooltip(mapEl) {
	var description = minimizeRttDescription().replace(/<br\s*\/?>(?:\s*)/gi, ' ');
	var header = mapEl.querySelector('th[data-widget="minRTT"]');
	if (!header)
		Array.prototype.some.call(mapEl.querySelectorAll('th'), function(item) {
			if (item.textContent.trim() === _('Minimize RTT')) {
				header = item;
				return true;
			}
			return false;
		});
	if (header) {
		header.setAttribute('title', description);
		header.setAttribute('data-description', description);
		header.setAttribute('aria-label', '%s: %s'.format(_('Minimize RTT'), description));
		header.style.cursor = 'help';
	}
}

function execTc(device) {
	var params = [ '-s', 'class', 'show', 'dev', device ];
	return fs.exec('/sbin/tc', params).then(function(result) {
		if (result && result.code && !result.stdout)
			return fs.exec('/usr/sbin/tc', params);
		return result;
	}).catch(function() {
		return fs.exec('/usr/sbin/tc', params);
	}).catch(function() {
		return { stdout: '' };
	});
}

var packetSizeUnits = { B: 1, KB: 1024 };
var connectionSizeUnits = { KB: 1024, MB: 1048576 };

function packetSize(value) {
	return qos.parseSize(value, packetSizeUnits, 'B');
}

function connectionSizeKb(value) {
	var bytes = qos.parseSize(value, connectionSizeUnits, 'KB');
	return bytes == null ? null : Math.round(bytes / 1024);
}

function addClassSection(m, direction) {
	var type = direction + '_class';
	var description = direction === 'download' ?
		_('Each service class is specified by four parameters: percent bandwidth at <br />capacity, realtime bandwidth and maximum bandwidth and the minimimze round <br />trip time flag.') :
		_('Each upload service class is specified by three parameters: percent <br />bandwidth at capacity, minimum bandwidth and maximum bandwidth.');
	var s = m.section(form.GridSection, type, _('Service Classes'), description);
	s.anonymous = true;
	s.addremove = true;
	s.sortable = false;
	s.cloneable = false;
	s.nodescriptions = true;
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
	var o = s.option(form.DummyValue, '_name', _('Class Name'));
	o.modalonly = false;
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'name') || _('None');
	};

	o = s.option(form.DummyValue, '_percent', _('Percent Bandwidth At Capacity'));
	o.modalonly = false;
	o.textvalue = function(id) {
		var value = +uci.get('qos_gargoyle', id, 'percent_bandwidth');
		return value > 0 ? '%d %%'.format(value) : _('Not set');
	};

	o = s.option(form.DummyValue, '_min', _('Minimum Bandwidth'));
	o.modalonly = false;
	o.textvalue = function(id) {
		return qos.formatBandwidth(uci.get('qos_gargoyle', id, 'min_bandwidth')) || _('Zero');
	};

	o = s.option(form.DummyValue, '_max', _('Maximum Bandwidth'));
	o.modalonly = false;
	o.textvalue = function(id) {
		return qos.formatBandwidth(uci.get('qos_gargoyle', id, 'max_bandwidth')) || _('Unlimited');
	};

	o = s.option(form.DummyValue, '_ld', '%s (kbps)'.format(_('Load')));
	o.modalonly = false;
	o.textvalue = function() {
		return '*';
	};

	o = s.option(form.Value, 'name', _('Service Class Name'));
	o.modalonly = true;
	o.rmempty = false;

	o = s.option(form.Value, 'percent_bandwidth', _('Percent Bandwidth At Capacity'),
		_('The percentage of the total available bandwidth that should be allocated to <br />this class when all available bandwidth is being used. If unused bandwidth <br />is available, more can (and will) be allocated. The percentages can be <br />configured to equal more (or less) than 100, but when the settings are <br />applied the percentages will be adjusted proportionally so that they add to <br />100. This setting only comes into effect when the WAN link is saturated.<br />'));
	o.modalonly = true;
	o.datatype = 'range(1, 100)';
	o.rmempty = false;

	o = s.option(form.Value, 'min_bandwidth', _('Minimum Bandwidth'),
		_('The minimum service this class will be allocated when the link is at <br />capacity. Classes which specify minimum service are known as realtime <br />classes by the active congestion controller. Streaming video, VoIP and <br />interactive online gaming are all examples of applications that must have a <br />minimum bandwith to function. To determine what to enter use the application <br />on an unloaded LAN and observe how much bandwidth it uses. Then enter a <br />number only slightly higher than this into this field. QoS will satisfiy the <br />minimum service of all classes first before allocating to other waiting <br />classes so be careful to use minimum bandwidths sparingly. Enter Mbps or kbps <br />(for example, 1m or 512k); values without a unit are treated as kbps.'));
	o.modalonly = true;
	o.value('0', _('Zero'));
	o.default = '0';
	o.cfgvalue = function(section_id) {
		var value = uci.get('qos_gargoyle', section_id, 'min_bandwidth');
		return qos.formatBandwidth(value == null ? '0' : value);
	};
	o.validate = function(section_id, value) {
		return !String(value || '').trim() || qos.parseBandwidth(value) != null ||
			_('Enter a valid bandwidth such as 20m or 512k.');
	};
	o.write = function(section_id, value) {
		var bandwidth = qos.parseBandwidth(value);
		uci.set('qos_gargoyle', section_id, 'min_bandwidth', String(bandwidth == null ? 0 : bandwidth));
	};

	o = s.option(form.Value, 'max_bandwidth', _('Maximum Bandwidth'),
		_('The maximum amount of bandwidth this class will be allocated. Even <br />if unused bandwidth is available, this service class will never be permitted <br />to use more than this amount of bandwidth. Enter Mbps or kbps (for example, <br />20m or 512k); values without a unit are treated as kbps. Leave empty for unlimited.'));
	o.modalonly = true;
	o.value('', _('Unlimited'));
	o.placeholder = _('Unlimited');
	o.cfgvalue = function(section_id) {
		return qos.formatBandwidth(uci.get('qos_gargoyle', section_id, 'max_bandwidth'));
	};
	o.validate = function(section_id, value) {
		var min = +uci.get('qos_gargoyle', section_id, 'min_bandwidth') || 0;
		var max = qos.parseBandwidth(value);
		return !String(value || '').trim() || max != null && max >= min ||
			(max == null ? _('Enter a valid bandwidth such as 20m or 512k.') :
				_('Maximum bandwidth must be greater than or equal to the minimum bandwidth.'));
	};
	o.write = function(section_id, value) {
		var bandwidth = qos.parseBandwidth(value);
		if (bandwidth == null)
			uci.unset('qos_gargoyle', section_id, 'max_bandwidth');
		else
			uci.set('qos_gargoyle', section_id, 'max_bandwidth', String(bandwidth));
	};

	if (direction === 'download') {
		/* Keep the grid readable while retaining the real flag in the edit modal. */
		o = s.option(form.DummyValue, '_minRTT', _('Minimize RTT'));
		o.modalonly = false;
		o.textvalue = function(id) {
			return uci.get('qos_gargoyle', id, 'minRTT') === 'Yes' ? _('Yes') : _('No');
		};

		o = s.option(form.Flag, 'minRTT', _('Minimize RTT'),
			minimizeRttDescription());
		o.modalonly = true;
		o.enabled = 'Yes';
		o.disabled = 'No';
		o.default = 'No';
	}

	return s;
}

function addRuleSection(m, direction, hosts, ndpi, dpiOutput) {
	var type = direction + '_rule';
	var classType = direction + '_class';
	var s = m.section(form.GridSection, type, _('Classification Rules'),
		_('Packets are tested against the rules in the order specified -- rules toward <br />the top have priority. As soon as a packet matches a rule it is classified, <br />and the rest of the rules are ignored. The order of the rules can be altered <br />using the arrow controls.'));
	s.anonymous = true;
	s.addremove = true;
	s.sortable = true;
	s.filterrow = true;
	s.nodescriptions = true;
	var normalizeOrder = function() {
		uci.sections('qos_gargoyle', type).forEach(function(section, index) {
			var order = String(index + 1);
			if (uci.get('qos_gargoyle', section['.name'], 'test_order') !== order)
				uci.set('qos_gargoyle', section['.name'], 'test_order', order);
		});
	};
	normalizeOrder();
	var refreshOrder = function() {
		normalizeOrder();
		window.requestAnimationFrame(function() {
			if (!s.map || !s.map.root)
				return;

			var table = s.map.root.querySelector('#cbi-qos_gargoyle-%s tbody'.format(type));
			if (!table)
				return;

			var rows = {};
			Array.prototype.forEach.call(table.querySelectorAll('tr[data-sid]'), function(row) {
				rows[row.getAttribute('data-sid')] = row;
			});
			uci.sections('qos_gargoyle', type).forEach(function(section) {
				var row = rows[section['.name']];
				if (row)
					table.appendChild(row);
			});
		});
	};
	[ 'handleDrop', 'handleTouchEnd', 'handleSort' ].forEach(function(method) {
		var inherited = s[method];
		if (typeof inherited === 'function') {
			s[method] = function() {
				var result = inherited.apply(this, arguments);
				if (method === 'handleSort')
					window.requestAnimationFrame(refreshOrder);
				else
					refreshOrder();
				return result;
			};
		}
	});
	s.handleRemove = function(section_id) {
		uci.remove('qos_gargoyle', section_id);
		normalizeOrder();
		return this.map.save(null, true);
	};
	s.handleAdd = function() {
		var id = uci.add('qos_gargoyle', type, qos.nextSectionName(type, type));
		uci.set('qos_gargoyle', id, 'family', 'any');
		normalizeOrder();
		m.addedSection = id;
		this.renderMoreOptionsModal(id);
	};
	var o = s.option(form.ListValue, 'class', _('Service Class'));
	addClassOptions(o, classType);
	o.rmempty = false;
	o.textvalue = function(id) {
		return qos.classLabel(uci.get('qos_gargoyle', id, 'class')) || _('Not set');
	};

	o = s.option(form.ListValue, 'proto', _('Transport Protocol'));
	o.value('', _('All'));
	[ 'tcp', 'udp', 'icmp', 'gre' ].forEach(function(value) { o.value(value, value.toUpperCase()); });
	o.textvalue = function(id) {
		var value = uci.get('qos_gargoyle', id, 'proto');
		return value ? value.toUpperCase() : _('All');
	};

	o = s.option(form.ListValue, 'family', _('Family'));
	o.value('any', _('All'));
	o.value('ipv4', 'ipv4');
	o.value('ipv6', 'ipv6');
	o.default = 'any';
	o.textvalue = function(id) {
		var value = uci.get('qos_gargoyle', id, 'family') || 'any';
		return value === 'any' ? _('All') : value;
	};

	o = s.option(form.Value, 'source', _('Source IP(s)'),
		_('Packet\'s source ip, can optionally have /[mask] after it (see -s option in <br />iptables man page).'));
	addHostOptions(o, hosts);
	o.datatype = 'or(ipmask4, ipmask6)';
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'source') || _('All');
	};

	o = s.option(form.Value, 'srcport', _('Source Port(s)'),
		_('Packet\'s source port, can be a range (eg. 80-90).'));
	o.value('', _('All'));
	o.datatype = 'or(port, portrange)';
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'srcport') || _('All');
	};

	o = s.option(form.Value, 'destination', _('Destination IP(s)'),
		_('Packet\'s destination ip, can optionally have /[mask] after it (see -d option <br />in iptables man page).'));
	addHostOptions(o, hosts);
	o.datatype = 'or(ipmask4, ipmask6)';
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'destination') || _('All');
	};

	o = s.option(form.Value, 'dstport', _('Destination Port(s)'),
		_('Packet\'s destination port, can be a range (eg. 80-90).'));
	o.value('', _('All'));
	o.datatype = 'or(port, portrange)';
	o.textvalue = function(id) {
		return uci.get('qos_gargoyle', id, 'dstport') || _('All');
	};

	o = s.option(form.Value, 'min_pkt_size', _('Minimum Packet Length'),
		_('Packet\'s minimum size (in bytes). You may suffix the value with KB; values without a unit are bytes.'));
	o.validate = function(section_id, value) {
		if (String(value || '').trim() === '')
			return true;

		var bytes = packetSize(value);
		return bytes != null && bytes >= 1 && bytes <= 1500 || _('Enter a packet length between 1 and 1500 bytes; optionally suffix with KB.');
	};
	o.write = function(section_id, value) {
		var bytes = packetSize(value);
		return uci.set('qos_gargoyle', section_id, 'min_pkt_size', bytes == null ? null : String(bytes));
	};
	o.textvalue = function(id) {
		return qos.formatBytes(uci.get('qos_gargoyle', id, 'min_pkt_size'));
	};

	o = s.option(form.Value, 'max_pkt_size', _('Maximum Packet Length'),
		_('Packet\'s maximum size (in bytes). You may suffix the value with KB; values without a unit are bytes.'));
	o.validate = function(section_id, value) {
		if (String(value || '').trim() === '')
			return true;

		var bytes = packetSize(value);
		if (bytes == null || bytes < 1 || bytes > 1500)
			return _('Enter a packet length between 1 and 1500 bytes; optionally suffix with KB.');

		var min = +uci.get('qos_gargoyle', section_id, 'min_pkt_size') || 0;
		return bytes >= min || _('Maximum packet length must be greater than or equal to the minimum packet length.');
	};
	o.write = function(section_id, value) {
		var bytes = packetSize(value);
		return uci.set('qos_gargoyle', section_id, 'max_pkt_size', bytes == null ? null : String(bytes));
	};
	o.textvalue = function(id) {
		return qos.formatBytes(uci.get('qos_gargoyle', id, 'max_pkt_size'));
	};

	o = s.option(form.Value, 'connbytes_kb', _('Connection Bytes Reach'),
		_('The total size of data transmitted since the establishment of the link (in kBytes). You may suffix the value with MB; values without a unit are kBytes.'));
	o.validate = function(section_id, value) {
		if (String(value || '').trim() === '')
			return true;

		var kb = connectionSizeKb(value);
		return kb != null && kb >= 0 && kb <= 4194303 || _('Enter a connection byte threshold between 0 and 4194303 kB; optionally suffix with MB.');
	};
	o.write = function(section_id, value) {
		var kb = connectionSizeKb(value);
		return uci.set('qos_gargoyle', section_id, 'connbytes_kb', kb == null ? null : String(kb));
	};
	o.textvalue = function(id) {
		var value = uci.get('qos_gargoyle', id, 'connbytes_kb');
		return value ? qos.formatBytes(+value * 1024) : _('Not set');
	};

	if (ndpi) {
		o = s.option(form.ListValue, 'ndpi', _('DPI Protocol'));
		addDpiOptions(o, dpiOutput);
	}

	return s;
}

return baseclass.extend({
	createView: function(direction) {
		return view.extend({
			load: function() {
				return Promise.all([
					uci.load('qos_gargoyle'),
					qos.callHostHints().catch(function() { return {}; }),
					fs.read('/proc/modules').catch(function() { return ''; }),
					fs.exec('/usr/sbin/iptables', [ '-m', 'ndpi', '--help' ]).catch(function() { return { stdout: '' }; }),
					network.getNetwork('wan').catch(function() { return null; })
				]);
			},

			render: function(data) {
				var m = new form.Map('qos_gargoyle', direction === 'upload' ? _('Upload QoS') : _('Download QoS'));
				var modules = data[2] || '';
				var ndpi = /(^|\n)xt_ndpi\s/.test(modules) || /ndpi/i.test((data[3] || {}).stdout || '');
				addClassSection(m, direction);
				addRuleSection(m, direction, data[1] || {}, ndpi, (data[3] || {}).stdout || '');
				this.qosServiceEnabled = uci.get_bool('qos_gargoyle', 'global', 'enable');
				if (direction === 'download') {
					var renderContents = m.renderContents;
					m.renderContents = function() {
						return renderContents.apply(this, arguments).then(function(mapEl) {
							addMinimizeRttTooltip(mapEl);
							return mapEl;
						});
					};
				}

				var previous = {};
				var device = direction === 'download' ? 'ifb0' : 'wan';
				var wanNetwork = data[4];
				if (direction === 'upload' && wanNetwork) {
					var l3 = wanNetwork.getL3Device();
					var l2 = wanNetwork.getL2Device();
					if (l3)
						device = l3.getName();
					else if (l2)
						device = l2.getName();
					else if (wanNetwork.getIfname())
						device = wanNetwork.getIfname();
				}

				return m.render().then(function(mapEl) {
					var update = function() {
						return execTc(device).then(function(result) {
							var current = {};
							qos.parseTcRates(result.stdout || '').forEach(function(rate) {
								current[rate.classid] = rate;
							});

							uci.sections('qos_gargoyle', direction + '_class').forEach(function(section, index) {
								var classid = index + 2;
								var cell = mapEl.querySelector('tr[data-sid="%s"] [data-name="_ld"]'.format(section['.name']));
								if (cell)
									cell.textContent = qos.rateText(current[classid], previous[classid]);
							});

							previous = current;
						});
					};

					poll.add(update, 3);
					return mapEl;
				});
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
	}
});

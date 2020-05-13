if (typeof(PhpDebugBar) == 'undefined') {
	// namespace
	const PhpDebugBar = new PhpDebugBar();
}

(function() {
	if (typeof(localStorage) == 'undefined') {
		// provide mock localStorage object for dumb browsers
		localStorage = {
			setItem: (key, value) => {},
			getItem: (key) => { return null; }
		};
	}

	class PhpDebugBar
	{
		static utils = {
			/**
			 * Returns the value from an object property.
			 * Using dots in the key, it is possible to retrieve nested property values
			 *
			 * @param {Object} dict
			 * @param {String} key
			 * @param {Object} default_value
			 * @return {Object}
			 */
			getDictValue: (dict, key, default_value) => {
				let d = dict, parts = key.split('.');
				for (let i = 0; i < parts.length; i++) {
					if (!d[parts[i]]) {
						return default_value;
					}
					d = d[parts[i]];
				}
				return d;
			},

			/**
			 * Counts the number of properties in an object
			 *
			 * @param {Object} object
			 * @return {Number}
			 */
			getObjectSize: (object) => {
				if (Object.keys) {
					return Object.keys(object).length;
				}

				let count = 0;
				for (let k in object) {
					if (object.hasOwnProperty(k)) {
						count++;
					}
				}

				return count;
			},

			/**
			 * Returns a prefixed css class name
			 *
			 * @param {String} cls class
			 * @return {String}
			 */
			cssClass: (cls, prefix) => {
				if (cls.indexOf(' ') > -1) {
					// must be clss as class is a reserved word
					let clss = cls.split(' '), out = [];
					for (let i = 0, c = clss.length; i < c; i++) {
						out.push(this.cssClass(clss[i], prefix));
					}

					return out.join(' ');
				}

				if (cls.indexOf('.') === 0) {
					return '.' + prefix + cls.substr(1);
				}

				return prefix + cls;
			},

			/**
			 * Creates a partial function of cssClass where the second
			 * argument is already defined
			 *
			 * @param  {string} prefix
			 * @return {Function}
			 */
			makeCssClass: (prefix) => {
				return function ( cls )
				{
					return self.cssClass( cls, prefix );
				};
			}
		};

		static Widget = class {
			_attributes;
			_boundAttributes;
			element;
			tagName = 'div';
			className = null;
			defaults = {};

			constructor(options)
			{
				this._attributes = {...this.defaults};
				this._boundAttributes = {};
				this.element = document.createElement(this.tagName);
				if (this.className) {
					this.element.className = this.className;
				}
				this.initialize.apply(this, [options || {}]);
				this.render.apply(this);
			}

			/**
			 * Called after the constructor
			 *
			 * @param {Object} options
			 */
			initialize(options) {
				this.set(options, null);
			}

			/**
			 * Called after the constructor to render the element
			 */
			render() {}

			/**
			 * Sets the value of an attribute
			 *
			 * @param {String|Object} attribute Can also be an object to set multiple attributes at once
			 * @param {Object} value
			 */
			set(attribute, value) {
				if (typeof(attribute) !== 'string') {
					for (let k in attribute) {
						this.set(k, attribute[k]);
					}
					return;
				}

				this._attributes[attribute] = value;
				if (typeof(this._boundAttributes[attribute]) !== 'undefined') {
					for (let i = 0, c = this._boundAttributes[attribute].length; i < c; i++) {
						this._boundAttributes[attribute][i].apply(this, [value]);
					}
				}
			}

			/**
			 * Checks if an attribute exists and is not null
			 *
			 * @param {String} attribute
			 * @return {boolean} [description]
			 */
			has(attribute) {
				return typeof(this._attributes[attribute]) !== 'undefined' && this._attributes[attribute] !== null;
			}

			/**
			 * Returns the value of an attribute
			 *
			 * @param {String} attribute
			 * @return {Object}
			 */
			get(attribute) {
				return this._attributes[attribute];
			}

			/**
			 * Registers a callback function that will be called whenever the value of the attribute changes
			 *
			 * If cb is a jQuery element, text() will be used to fill the element
			 *
			 * @param {String} attribute
			 * @param {Function} callback
			 */
			bindAttribute(attribute, callback) {
				if (Array.isArray(attribute)) {
					for (let i = 0, c = attribute.length; i < c; i++) {
						this.bindAttribute(attribute[i], callback);
					}
					return;
				}

				if (typeof(this._boundAttributes[attribute]) == 'undefined') {
					this._boundAttributes[attribute] = [];
				}

				if (typeof(callback) == 'object') {
					let element = callback;
					callback = function(value) { element.text(value || ''); };
				}

				this._boundAttributes[attribute].push(callback);

				if (this.has(attribute)) {
					callback.apply(this, [this._attributes[attribute]]);
				}
			}
		}
	}

	let cssClass = PhpDebugBar.utils.makeCssClass('phpdebugbar-');

	/**
	 * Creates a subclass
	 *
	 * Code from Backbone.js
	 *
	 * @param {Array} props Prototype properties
	 * @return {Function}
	 */
	PhpDebugBar.Widget.extend = function(props) {
		let parent = this;

		let child = function() { return parent.apply(this, arguments); };
		this.extend(child, parent);

		let Surrogate = function() { this.constructor = child; };
		Surrogate.prototype = parent.prototype;
		child.prototype = new Surrogate;
		this.extend(child.prototype, props);

		child.__super__ = parent.prototype;

		return child;
	};

	/**
	 * Tab
	 *
	 * A tab is composed of a tab label which is always visible and
	 * a tab panel which is visible only when the tab is active.
	 *
	 * The panel must contain a widget. A widget is an object which has
	 * an element property containing something appendable to a jQuery object.
	 *
	 * Options:
	 *  - title
	 *  - badge
	 *  - widget
	 *  - data: forward data to widget data
	 */
	let Tab = Widget.extend({

		className: cssClass('panel'),

		render: function() {
			this.icon = document.createElement('i');
			this.tab = document.createElement('a').className = cssClass('tab');
			this.tab.appendChild(this.icon);

			this.bindAttribute('icon', function(icon) {
				if (icon) {
					this.icon.setAttribute('class', `phpdebugbar-fa phpdebugbar-fa-${icon}`);
				} else {
					this.icon.setAttribute('class', '');
				}
			});

			let title = document.createElement('span').className = cssClass('text');
			this.bindAttribute('title', this.tab.appendChild(title));

			let badge = document.createElement('span').className = cssClass('badge');
			this.badge = this.tab.appendChild(badge);
			this.bindAttribute('badge', function(value) {
				if (value !== null) {
					this.badge.appendChild(document.createTextNode(value));
					this.badge.className = cssClass('visible');
				} else {
					this.badge.classList.remove(cssClass('visible'));
				}
			});

			this.bindAttribute('widget', function(widget) {
				this.element.empty().append(widget.element);
			});

			this.bindAttribute('data', function(data) {
				if (this.has('widget')) {
					this.get('widget').set('data', data);
				}
			});
		}
	});

	/**
	 * Indicator
	 *
	 * An indicator is a text and an icon to display single value information
	 * right inside the always visible part of the debug bar
	 *
	 * Options:
	 *  - icon
	 *  - title
	 *  - tooltip
	 *  - data: alias of title
	 */
	let Indicator = Widget.extend({

		tagName: 'span',

		className: cssClass('indicator'),

		render: () => {
			let icon = document.createElement('i');
			this.icon = this.element.appendChild(icon);
			this.bindAttribute('icon', function(icon) {
				if (icon) {
					this.$icon.setAttribute('class', `phpdebugbar-fa phpdebugbar-fa-${icon}`);
				} else {
					this.$icon.setAttribute('class', '');
				}
			});

			this.bindAttr(['title', 'data'], $('<span />').addClass(csscls('text')).appendTo(this.$el));

			this.$tooltip = $('<span />').addClass(csscls('tooltip disabled')).appendTo(this.$el);
			this.bindAttr('tooltip', function(tooltip) {
				if (tooltip) {
					this.$tooltip.text(tooltip).removeClass(csscls('disabled'));
				} else {
					this.$tooltip.addClass(csscls('disabled'));
				}
			});
		}

	});
})();
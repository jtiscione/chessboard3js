
/**
 * Sonic Gauge jQuery Plugin v0.3.0
 * jQuery plugin to create and display SVG gauges using RaphaelJS
 * 
 * Copyright (c) 2013 Andy Burton (http://andyburton.co.uk)
 * GitHub https://github.com/andyburton/Sonic-Gauge
 * 
 * Licensed under the MIT license (http://andyburton.co.uk/license/mit.txt)
 */

(function($){
	
	var methods	= {
		
		/**
		 * Initialise object
		 */
		
		init : function (options)
		{
			
			if (!this.length)
			{
				return this;
			}
			
			this.options	= $.extend (true, {}, $.fn.SonicGauge.defaultOptions);
			this.settings	= {};
			
			this.SonicGauge ('setOptions', options);
			this.SonicGauge ('draw');
			
			return this;
			
		},
		
		/**
		 * Set options
		 */
		
		setOptions : function (options)
		{
			
			if (options)
			{
				$.extend (true, this.options, options);
			}
			
			this.settings.canvas_d	= this.options.diameter;
			this.settings.canvas_r	= this.settings.canvas_d / 2;
			this.settings.speedo_d	= this.settings.canvas_d - this.options.margin * 2;
			this.settings.speedo_r	= this.settings.speedo_d / 2;
			this.settings.increment	= (this.options.end.angle - this.options.start.angle) / (this.options.end.num - this.options.start.num);
			
			return this;
			
		},
		
		/**
		 * Draw gauge
		 */

		draw : function ()
		{
			
			// Reference scope
			
			var p	= this;
			
			// Set element size
			// This fixes the firefox issue causing the digital dial position to be incorrect
			// As the raphael canvas still hasnt rendered causing incorrect width/height
			
			this.width (this.settings.canvas_d);
			this.height (this.settings.canvas_d);
			
			// Init Raphael element
			
			this.gauge		= Raphael (this.attr ('id'), this.settings.canvas_d, this.settings.canvas_d);
			
			// Set gauge outline
			
			var outline		= this.gauge.circle (this.settings.canvas_r, this.settings.canvas_r, this.settings.speedo_r).attr (this.options.style.outline);
			
			// Gauge label
			
			var label_x	= this.settings.canvas_r;
			var label_y	= this.settings.canvas_r - (this.settings.canvas_r / 4);
			
			if (typeof this.options.label == "object")
			{
				
				if (this.options.label.margin_x)
				{
					label_x += this.options.label.margin_x;
				}
				
				if (this.options.label.margin_y)
				{
					label_y += this.options.label.margin_y;
				}
				
			}
			else if (typeof this.options.label == "string")
			{
				this.options.label	= {value: this.options.label};
			}
			
			if (this.options.label)
			{
				var label	= this.gauge.text (label_x, label_y, this.options.label.value).attr (this.options.style.label);
			}
			
			// Draw sectors
			// Thanks to Thomas M aka Arctic SnowSky

			this.sectors	= [];

			$.each (this.options.sectors, function (i) {
				
				this.style = $.extend (true, p.options.style.sector, this.style);

				if (!(isNaN (this.start) || isNaN (this.end)))
				{
					
					var startAngle	= p.settings.increment * (this.start - p.options.start.num) + p.options.start.angle;
					var endAngle	= p.settings.increment * (this.end - p.options.start.num) + p.options.start.angle;
					
					var r			= this.radius? this.radius : p.settings.speedo_r;
					var rad			= Math.PI / 180;
					
					var x1 = p.settings.canvas_r + r * Math.cos (startAngle * rad),
						x2 = p.settings.canvas_r + r * Math.cos (endAngle * rad),
						y1 = p.settings.canvas_r + r * Math.sin (startAngle * rad),
						y2 = p.settings.canvas_r + r * Math.sin (endAngle * rad);

					var sect = p.gauge.path ([
						"M", p.settings.canvas_r, p.settings.canvas_r,
						"L", x2, y2,
						"A", r, r, 0, + (endAngle - startAngle > 180),
						0, x1, y1, "z"]).attr (this.style);

					p.sectors.push (sect);
					
				}
				
			});
			
			// Generate markers
			
			var markers		= [];

			$.each (this.options.markers, function () {
				
				if (this.line)
				{
					
					if (!this.line.width)
					{
						this.line.width = 10;
					}
					
					if (!this.line.height)
					{
						this.line.height = 1;
					}
					
					var line	= p.gauge.rect (p.settings.canvas_r + p.settings.speedo_r - this.line.width, p.settings.canvas_r - Math.floor (this.line.height / 2)).attr (this.line).hide ();

				}
				
				// Work around JS precision problems with marker gaps < 1
				
				var divide	= 1;
				
				while (this.gap < 1)
				{
					divide *= 10;
					this.gap *= 10;
				}
				
				var start	= p.options.start.num * divide;
				var end		= p.options.end.num * divide;
				
				// Add marker points
				
				for (var count = start; count <= end; count += this.gap)
				{
					
					var val	= divide > 1? count / divide : count;
					
					if (this.toFixed)
					{
						val = val.toFixed (this.toFixed);
					}
					
					if (this.toPrecision)
					{
						val = val.toPrecision (this.toPrecision);
					}
					
					// Work out angle of rotation for value
					
					var a	= p.settings.increment * (val - start) + p.options.start.angle;
					
					// Work out relative to complete 360 rotation
					
					if (a + Math.abs (p.options.start.angle) >= 360)
					{
						a = (a + Math.abs (p.options.start.angle)) % 360 + p.options.start.angle;
					}
					
					// Dont place multiple markers in the same location
					
					if ($.inArray (a, markers) >= 0)
					{
						continue;
					}
					
					markers.push (a);
					
					// Marker line
					
					if (this.line)
					{
						var speed_marker = line.clone ().rotate (a, p.settings.canvas_r, p.settings.canvas_r);
					}
					
					// Marker text
					
					if (this.text)
					{

						if (!this.text.space)
						{
							this.text.space = 0;
						}
						
						var txt	= val;
						
						if (typeof this.value == "object")
						{
							
							if (this.value.divide)
							{
								txt /= this.value.divide;
							}
							
							if (this.value.multiply)
							{
								txt *= this.value.multiply;
							}
							
						}
						
						var rad		= a.toRadians ();
						var x		= p.settings.canvas_r + (this.text.space + p.settings.speedo_r) * Math.cos (rad);
						var y		= p.settings.canvas_r + (this.text.space + p.settings.speedo_r) * Math.sin (rad);
						var text	= p.gauge.text (x, y, txt).attr (this.text);

					}

				}

				if (this.line)
				{
					line.remove ();
				}

			});
			
			// Create digital display
			
			if (this.options.digital)
			{
				this.digital	= $('<div>').addClass ('digital').css ({
					"margin-top"		: Math.ceil (this.settings.speedo_r / 2),
					"width"				: "20%",
					"font-family"		: "Arial",
					"font-size"			: 20,
					"color"				: '#fff',
					"text-align"		: "center",
					"border"			: "2px solid #777",
					"border-radius"		: 10,
					"padding"			: 5,
					"background-color"	: "#111"
				}).css (this.options.digital).text (this.options.default_num).appendTo (this).center ();
			}
			
			// Create needle indicators
			
			this.needles	= [];
			
			$.each (this.options.needles, function (i) {
				
				if (!this.default_num)
				{
					this.default_num = p.options.default_num;
				}
				
				this.style = $.extend (true, p.options.style.needle, this.style);
				
				var val	= this.default_num - p.options.start.num;
				
				if (typeof this.value == "object")
				{
					
					if (this.value.divide)
					{
						val /= this.value.divide;
					}

					if (this.value.multiply)
					{
						val *= this.value.multiply;
					}

				}
				
				var rotate	= p.settings.increment * val + p.options.start.angle;
				
				var needle	= p.gauge.rect (p.settings.canvas_r, p.settings.canvas_r, p.settings.speedo_r).attr (this.style)
					.transform ("r" + rotate + "," + p.settings.canvas_r + "," + p.settings.canvas_r);
				
				p.needles.push (needle);
				
			});
			
			// Set marker center point
			
			if (typeof this.options.style.center == "object")
			{
				var center		= this.gauge.circle (this.settings.canvas_r, this.settings.canvas_r, this.options.style.center.diameter).attr (this.options.style.center);
			}
			
			this.trigger ('drawn');
			
			return this;
			
		},

		/**
		 * Set gauge value
		 */

		val : function (val)
		{
			
			if (this.digital)
			{
				var txt	= val;
				
				if (this.options.digital_toFixed)
				{
					txt = txt.toFixed (this.options.digital_toFixed);
				}
				
				if (this.options.digital_toPrecision)
				{
					txt = txt.toPrecision (this.options.digital_toPrecision);
				}
				
				this.digital.text (txt);
			}
			
			var p = this;
			
			$.each (this.needles, function (i) {
				
				var new_val = val;
				
				if (typeof p.options.needles[i].value == "object")
				{
					
					var val_modify	= p.options.needles[i].value;
					
					if (val_modify.divide)
					{
						new_val /= val_modify.divide;
					}

					if (val_modify.multiply)
					{
						new_val *= val_modify.multiply;
					}

				}
				
				this.animate ({transform: "r" + (p.settings.increment * (new_val - p.options.start.num) + p.options.start.angle) + "," + p.settings.canvas_r + "," + p.settings.canvas_r}, p.options.animation_speed);
			
			});
			
			this.trigger ('update', val);
			
			return this;
			
		}
		
	};
	
	/**
	 * Constructor
	 */
	
	$.fn.SonicGauge = function (method) {
		
		// Call method and set options

		if (methods[method]){
			return methods[method].apply (this, Array.prototype.slice.call (arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return methods.init.apply (this, arguments);
		} else {
			$.error ('Method ' +  method + ' does not exist on jQuery.SonicGauge');
		}
		
	};
	
	/**
	 * Default options
	 */
	
	$.fn.SonicGauge.defaultOptions = {
		margin			: 35,
		diameter		: 350,
		start			: {angle: -225, num: 0},
		end				: {angle: 45, num: 100},
		default_num		: 0,
		animation_speed	: 1000,
		digital			: {},
		digital_toFixed	: 0,
		needles			: [{}],
		sectors			: [{}],
		markers			: [
			{
				gap: 10,
				line: {"width": 20, "stroke": "none", "fill": "#eeeeee"},
				text: {"space": 22, "text-anchor": "middle", "fill": "#333333", "font-size": 18}
			},{
				gap: 5, 
				line: {"width": 8, "stroke": "none", "fill": "#999999"}
			}
		],
		style			: {
			"outline"	: {"fill": "#333333", "stroke": "#555555", "stroke-width": 8},
			"center"	: {"fill": "#eeeeee", "diameter": 10},
			"needle"	: {"height": 1, "stroke": "none", "fill": "#cc0000"},
			"label"		: {"text-anchor": "middle", "fill": "#fff", "font-size": 16}
		}
	};
	
})(jQuery);

/**
 * Convert decimal to radians
 */

if (typeof (Number.prototype.toRadians) === "undefined") {
	Number.prototype.toRadians = function () {
		return this * Math.PI / 180;
	}
}

/**
 * Number of decimal places
 */

if (typeof (Number.prototype.decimalPlaces) === "undefined") {
	Number.prototype.decimalPlaces = function () {
		return (this.toFixed (20)).replace (/^-?\d*\.?|0+$/g, '').length;
	}
}

/**
 * Center element position
 */

if (typeof (jQuery.fn.center) === "undefined") {
	jQuery.fn.center = function (p) {
		
		if (typeof p === "undefined")
		{
			p = this.parent ();
		}
		
		p.css ("position", "relative");
		
		return this.css ("position", "absolute").css ({
			top		: Math.max (0, ((p.height () - this.outerHeight ()) / 2) + p.scrollTop ()),
			left	: Math.max (0, ((p.width () - this.outerWidth ()) / 2) + p.scrollLeft ())
		});
		
	}
}
define([
            'jquery',
            'underscore',
            'api/SplunkVisualizationBase',
            'api/SplunkVisualizationUtils',
            'd3',
            'moment',
            '../contrib/d3-timeline',
            'bootstrap/js/tooltip'
        ],
        function(
            $,
            _,
            SplunkVisualizationBase,
            vizUtils,
            d3,
            moment,
            bs
        ) {

    // Truncates a string to a length, optionally adding a suffix
    var truncate = function(str, maxLength, suffix) {
        maxLength = maxLength || 25;
        suffix = suffix || '...';
        str = str || 'null';
        if (str.length > maxLength) {
            str = str.substring(0, maxLength + 1);
            str = str + suffix;
        }
        return str;
    }

    var TIME_FORMATS = {
        'DAYS': '%x',
        'MINUTES': '%H:%M',
        'SECONDS': '%X',
        'SUBSECONDS': '%X %L'
    };

    var STRIP_TIMEZONE_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.{0,1}(\d*))[+-]{1}\d{2}[:]?\d{2}$/;

    var LEGEND_WIDTH = 200;
    var LEGEND_MARGIN = 40;
    var LEGEND_RECT_SIZE = 18;
    var LEGEND_SPACING = 8;
    var LEGEND_MARGIN_TOP = 30;

    var LABEL_WIDTH = 150;
    var TIMELINE_LABEL_MARGIN = 15;
    var ITEM_HEIGHT = 20;
    var ITEM_MARGIN = 5;
    var CHART_PADDING = 15;

    return SplunkVisualizationBase.extend({

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);

            this.$el = $(this.el);
            this.$el.addClass('splunk-timeline');

            this.compiledTooltipTemplate = _.template(this._tooltipTemplate);
            this.tooltipContainer = $('<div class="splunk-timeline-tooltip" style="position:relative"></div>').appendTo('body');
        },

        formatData: function(data) {
            var fields = data.fields;
            var rows = data.rows;
            var config = this._getConfig();
            var useColors = vizUtils.normalizeBoolean(this._getEscapedProperty('useColors', config));
            var timeIndex = 0;
            var resourceIndex = 1;
            var durationIndex = useColors ? 3 : 2;

            if (rows.length < 1 && fields.length < 1) {
                return false;
            }

            if (useColors && fields.length < 3) {
                throw new SplunkVisualizationBase.VisualizationError(
                    'Check the Statistics tab. To generate a colorized timeline, the results table must include columns representing these three dimension types: <time>, <resource>, <color>.'
                );
            }

            var groups = {};
            var result = [];
            var colorCategories = {};

            // 0 -> _time
            // 1 -> resourceField
            // 2 -> [colorField | duration]
            // 3 -> [duration]
            // n optional key value pairs
            var minStartingTime = +new Date;
            var maxEndingTime = 0;
            var nonNumericalCategories = false;

            _.each(rows, function(row) {
                var group = row[resourceIndex];
                // if row[2] is a number we assume it's epoch time.
                // epoch time is specified in seconds, so it has to be multiplied by 1000
                var startTime = _.isNaN(+row[timeIndex]) ? +vizUtils.parseTimestamp(row[timeIndex]) : +row[timeIndex]*1000;

                if (_.isNaN(startTime)) {
                    throw new SplunkVisualizationBase.VisualizationError(
                        'Invalid time format specified: ' + vizUtils.escapeHtml(row[timeIndex]) + '. ' +
                        'Supported time formats are RFC2822, ISO 8601, and epoch time'
                    );
                }
                var endTime = false;
                if (!_.isNaN(+row[durationIndex]) && (startTime +(+row[durationIndex])) !== startTime) {
                    endTime = Math.round(startTime + (+row[durationIndex]));
                }
                if (!groups[group]) {
                    groups[group] = [];
                }
                var entry = {
                    starting_time: startTime
                };
                minStartingTime = Math.min(minStartingTime, startTime);
                maxEndingTime = Math.max(maxEndingTime, endTime ? endTime : startTime);
                if (endTime) {
                    entry['ending_time'] = Math.round(endTime);
                } else {
                    entry['display'] = 'circle';
                }
                var category = useColors ? row[2] : 'default_category';
                if (_.isNaN(+category)) {
                    nonNumericalCategories = true;
                } else {
                    category = +category;
                }
                colorCategories[category] = 1;
                entry['resource'] = row[resourceIndex];
                entry['category'] = category;
                entry['class'] = 'ccat-' + category;

                var sliceIndex = useColors ? 4 : 3;
                var rowKeyVals = row.slice(sliceIndex);
                var meta = {};
                _.each(rowKeyVals, function(m, i) {
                    meta[fields[i+sliceIndex].name] = m;
                });
                entry['meta'] = meta;

                groups[group].push(entry);
            });


            _.each(groups, function(group, key) {
                result.push({
                    label: key,
                    times: group
                });
            });

            return {
                nonNumericalCategories: nonNumericalCategories,
                beginning: minStartingTime,
                ending: maxEndingTime,
                chartData: result,
                colorCategories: _.keys(colorCategories),
                fields: fields,
                indexes: {
                    resourceIndex: resourceIndex,
                    timeIndex: timeIndex,
                    durationIndex: durationIndex
                }
            }
        },

        updateView: function(data, config) {

            if (!data || data.length < 1) {
                return
            }
            this.$el.empty();
            this.tooltipContainer.empty();
            this.useDrilldown = this._isEnabledDrilldown(config);

            var fields = data.fields;
            var indexes = data.indexes;
            var width = this.$el.width();
            var height = this.$el.height();

            var useColors = vizUtils.normalizeBoolean(this._getEscapedProperty('useColors', config));
            var colorMode = this._getEscapedProperty('colorMode', config) || 'categorical';
            var numOfBins = this._getEscapedProperty('numOfBins', config) || 6;
            var minColor = this._getEscapedProperty('minColor', config) || '#FFE8E8';
            var maxColor = this._getEscapedProperty('maxColor', config) || '#DA5C5C';
            var axisTimeFormat = TIME_FORMATS[this._getEscapedProperty('axisTimeFormat', config) || 'SECONDS'];
            var tooltipTimeFormat = TIME_FORMATS[this._getEscapedProperty('tooltipTimeFormat', config) || 'SECONDS'];

            var colorScale;
            var chartWidth;
            var categoryScale;

            if (useColors) {
                chartWidth = width - LEGEND_WIDTH - LEGEND_MARGIN;

                if (colorMode == 'categorical') {
                    categoryScale = d3.scale.ordinal()
                        .domain(data.colorCategories)
                        .range(data.colorCategories);
                    colorScale = d3.scale.ordinal()
                        .domain(data.colorCategories)
                        .range(vizUtils.getColorPalette('splunkCategorical'));
                } else {
                    if (data.nonNumericalCategories) {
                        throw new SplunkVisualizationBase.VisualizationError(
                            'Invalid color field type specified for sequential colorization. ' +
                            'Sequential colorization requires a numerical color field'
                        );
                    }
                    var colorCategories = data.colorCategories.map(function(item) { return parseInt(item, 10); });
                    var min = _.min(colorCategories);
                    var max = _.max(colorCategories);
                    var domain = [];
                    var range = [];
                    var interpolateNum = d3.interpolateRound(min, max);
                    var interpolateColor = d3.interpolateHcl(minColor, maxColor); //Rgb, Hcl, Hsl

                    for(var x = 0; x < numOfBins; x++) {
                        domain.push(interpolateNum(x/(numOfBins-1)));
                        range.push(interpolateColor(x/(numOfBins-1)));
                    }

                    colorScale = d3.scale.ordinal()
                                .domain(domain)
                                .range(range);

                    var categoryDomain = [];
                    var categoryRange = [];

                    // binning
                    for (var i = 0; i < colorCategories.length; i++) {
                        var colorCategory = colorCategories[i];
                        var bin = -1;
                        for (var o = 0; o < domain.length; o++) {
                            if (domain[o] <= colorCategory) {
                                bin++;
                                continue;
                            }
                        }
                        categoryDomain.push(colorCategory);
                        categoryRange.push(domain[bin]);
                    }
                    categoryScale = d3.scale.ordinal()
                                        .domain(categoryDomain)
                                        .range(categoryRange);
                }

            } else {
                chartWidth = width - 25;
                categoryScale = d3.scale.ordinal()
                        .domain(data.colorCategories)
                        .range(data.colorCategories);
                colorScale = d3.scale.ordinal()
                    .domain(data.colorCategories)
                    .range(['rgb(30, 147, 198)']);
            }

            var containerEl = d3.select(this.el);

            var that = this;

            var tooltipContainer = this.tooltipContainer;
            var chart = d3.timeline()
                .orient('top')
                .showAxisTop()
                .stack()
                .colors(function(d) { return colorScale(categoryScale(d)); })
                .colorProperty('category')
                .width(chartWidth)
                // if there is no interval (i.e. only one event) show a 100ms interval
                .ending(data.beginning !== data.ending ? data.ending : data.ending + 100)
                .mouseover(function(d, i, el) {
                    el.attr('fill-opacity', .6)
                        .attr('stroke-width', 2);

                    // mute all elements of another color category
                    containerEl.selectAll('circle, rect:not(.row-green-bar)')
                        .transition(200)
                        .style('opacity', function() {
                            return el.attr('class') === d3.select(this).attr('class') ? 1 : .1;
                        });

                    // label alignment and content generation
                    var tagName = el.node().tagName;
                    var elementX = 0;
                    var elementY = 0;
                    var elementWidth = 0;

                    var timeSpanString = d3.time.format(tooltipTimeFormat)(new Date(d.starting_time)) +
                            (d.ending_time ? ' - ' + d3.time.format(tooltipTimeFormat)(new Date(d.ending_time)) : '');

                    var tooltipContent = that.compiledTooltipTemplate({
                        timeSpan: timeSpanString,
                        firstFieldName: vizUtils.escapeHtml(fields[indexes.resourceIndex].name),
                        secondFieldName: useColors ? vizUtils.escapeHtml(fields[2].name) : '',
                        resource: vizUtils.escapeHtml(d.resource),
                        category: useColors ? vizUtils.escapeHtml(d.category) : false,
                        color: (useColors ? colorScale(categoryScale(d.category)) : 'white')
                    });

                    if (tagName === 'rect') {
                        elementX = +el.attr('x');
                        elementY = +el.attr('y');
                    } else if (tagName === 'circle') {
                        elementX = +el.attr('cx');
                        elementY = +el.attr('cy');
                    }

                    if (elementY > height/2) {
                        var placement = "top";
                    } else {
                        var placement = "bottom";
                    }

                    $(el).tooltip({
                        animation: false,
                        'title': tooltipContent,
                        'html': true,
                        'container': tooltipContainer,
                        'placement': placement
                    })
                    .tooltip('show');

                })
                .mouseout(function(d, i, el) {
                    el.attr('fill-opacity', .5)
                        .attr('stroke-width', 1);
                    containerEl.selectAll('circle, rect').transition(200).style('opacity', 1);

                    $(el).tooltip('destroy');
                })
                .click(this._drilldown.bind(this))
                .labelFormat(function(label) {
                    return truncate(label, 15);
                })
                .itemHeight(ITEM_HEIGHT)
                .itemMargin(ITEM_MARGIN)
                .labelMargin(TIMELINE_LABEL_MARGIN)
                .tickFormat({
                    format: d3.time.format(axisTimeFormat),
                    tickTime: d3.time.minutes,
                    numTicks: 6,
                    tickSize: 3
                })
                .background(function(d, i) {
                    return i % 2 === 0 ? '#F5F5F5': 'white'
                })
                .fullLengthBackgrounds(true)
                .margin({left: LABEL_WIDTH, right:30, top: 30, bottom:0});

            var width = this.$el.width();
            var height = this.$el.height();

            var svgHeight = Math.max(
                // chart height
                (data.chartData.length + 1) * (ITEM_HEIGHT + 2*ITEM_MARGIN) +
                    2 * CHART_PADDING,
                // legend height
                (((colorScale.domain() || []).length + 1) *
                    (LEGEND_RECT_SIZE + LEGEND_SPACING) + LEGEND_MARGIN_TOP) *
                    // if there's no legend we don't need to take it into
                    // the chart height calculation
                    (useColors ? 1 : 0)
            );

            var svg = d3.select(this.el).append('svg')
                .attr('width', width - 20)
                .attr('height', svgHeight)
                .style('padding', CHART_PADDING + 'px')
                .datum(data.chartData).call(chart);

            svg.selectAll('circle,rect:not(.row-green-bar)')
                .attr('r', 8)
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 1)
                .attr('stroke', function(d) { return colorScale(categoryScale(d.category)); })
                .attr('fill-opacity', .5)
                .attr('class', function(d) { return 'ccat-' + (colorMode === 'categorical' ? d.category : categoryScale(d.category)); });

            var tooltip = d3.select(this.el).append('div')
                .attr('class', 'modviz-tooltip')
                .style('opacity', 0);

            // add timeline label tooltips (for truncated labels)
            svg.selectAll('.timeline-label')
                .append('title')
                .text(function(d, i) { return d[i].label; });

            if (useColors) {

                var legend = svg.selectAll('.legend')
                    .data(colorScale.domain())
                    .enter()
                    .append('g')
                    .attr('class', 'legend')
                    .attr('transform', function(d, i) {
                        var height = LEGEND_RECT_SIZE + LEGEND_SPACING;
                        var horz = width - LEGEND_WIDTH;
                        var vert = i * height + LEGEND_MARGIN_TOP;
                        return 'translate(' + horz + ',' + vert + ')';
                    })
                    .on('mouseover', function(d, i) {
                        var currentLegendEl = d3.select(this);
                        currentLegendEl.select('text')
                            .style('font-weight', 'bold');
                        var rect = currentLegendEl.select('rect');
                        containerEl.selectAll('circle, rect')
                            .transition(200)
                            .style('opacity', function() {
                                return rect.attr('class') === d3.select(this).attr('class') ? 1 : .1;
                            });
                    })
                    .on('mouseout', function(d, i) {
                        d3.select(this)
                            .select('text')
                            .style('font-weight', 'normal');
                        containerEl.selectAll('circle, rect').transition(250).style('opacity', 1);
                    })
                legend.append('rect')
                  .attr('width', LEGEND_RECT_SIZE)
                  .attr('height', LEGEND_RECT_SIZE)
                  .attr('class', function(d) { return 'ccat-' + d; })
                  .attr('fill', colorScale)
                  .attr('fill-opacity', .5)
                  .attr('stroke-width', 1)
                  .style('stroke', colorScale);

                legend.append('text')
                  .attr('x', LEGEND_RECT_SIZE + 2 * LEGEND_SPACING)
                  .attr('y', LEGEND_RECT_SIZE - LEGEND_SPACING + LEGEND_RECT_SIZE / 6)
                  .text(function(d) { return (colorMode === 'categorical' ? '' : '>= ') + truncate(d, 18); })
                  .append('title')
                    .text(function(d) { return (colorMode === 'categorical' ? '' : '>= ') + d; });
            }

            if (this.useDrilldown) {
                this.$el.addClass('timeline-drilldown');
            } else {
                this.$el.removeClass('timeline-drilldown');
            }

            return this;
        },

        getInitialDataParams: function() {
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            };
        },

        reflow: function() {
            this.invalidateUpdateView();
        },

        _getEscapedProperty: function(name, config) {
            var propertyValue = config[this.getPropertyNamespaceInfo().propertyNamespace + name];
            return vizUtils.escapeHtml(propertyValue);
        },

        _getConfig: function() {
            return this._config;
        },

        _drilldown: function(d, i) {
            var fields = this.getCurrentData().fields;
            var drilldownDescription = {
                action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                data: {}
            };
            drilldownDescription.data[fields[1].name] = d.resource;
            if(this.useColors) {
                drilldownDescription.data[fields[2].name] = d.category;
            }

            var timeField = fields[0];
            // If the starting time is Splunk's event indexed time field, then drilldown
            // to a custom time range.
            // If not, perform a field-value match on the starting time.
            if (timeField.name === '_time') {
                var startingTimeSeconds = d.starting_time / 1000;
                var endingTimeSeconds = d.ending_time / 1000;

                drilldownDescription.earliest = startingTimeSeconds;
                drilldownDescription.latest = endingTimeSeconds + 0.001;
            } else {
                drilldownDescription.data[timeField.name] = d.starting_time;
            }

            this.drilldown(drilldownDescription, d3.event);
        },

        _isEnabledDrilldown: function(config) {
            if (config['display.visualizations.custom.drilldown'] && config['display.visualizations.custom.drilldown'] === 'all') {
                return true;
            }
            return false;
        },

        _tooltipTemplate: '\
                <p class="time-span-label"><%= timeSpan %></p>\
                <div class="tooltip-meta">\
                    <p><span><%= firstFieldName %>: </span><span><%= resource %></span></p>\
                    <% if (category) { %>\
                        <p><span><%= secondFieldName %>: </span><span style="color:<%= color %>;"><%= category %></span></p>\
                    <% } %>\
                </div>\
        '
    });
});
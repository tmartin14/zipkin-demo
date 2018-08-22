/*
Copyright (c) 2016 Stephane Lapie <slapie@splunk.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
define([
            'jquery',
            'underscore',
            'lodash',
            'graphlib',
            'dagre',
            'jointjs',
            'd3',
            'splunkjs/mvc',
            'util/general_utils',
            'models/search/Job',
            'models/search/Report',
            'models/services/search/jobs/Result',
            'vizapi/SplunkVisualizationBase',
            'vizapi/SplunkVisualizationUtils',
            'splunkjs/mvc/sharedmodels',
            'collections/services/data/ui/WorkflowActions',
            'views/shared/eventsviewer/shared/WorkflowActions',
            'CustomWorkflowActionsView'
        ],
        function(
            $,
            _,
            lodash,
            graphlib,
            dagre,
            joint,
            d3,
            mvc,
            genUtils,
            SearchJobModel,
            SearchReportModel,
            ResultModel,
            SplunkVisualizationBase,
            vizUtils,
            sharedModels,
            WorkflowActionsCollection,
            WorkflowActionsView,
            CustomWorkflowActionsView
        ) {
  
    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({

        // Default parameters
        $el: null,
        panelDiv: null,
        graph: null,
        paper: null,
        data: null,
        sourceFieldName: null,
        targetFieldName: null,
        measureOneName: null,
        color: null,
        colorMode: 'categorical',
        colorCategories: ['success', 'warning', 'error'],
        useColors: true,
        maxColor: '#d93f3c',
        minColor: '#3fc77a',
        okColor: '#3fc77a',
        warnColor: '#f58f39',
        errColor: '#d93f3c',
        drilldownBehavior: 'none',
        drilldownValue: 'node',
        drilldownToken: 'jointjs_diagram',
        numOfBins: 5,
        direction: "TB",
        scale: 1,
        useMouseScale: false,
        useAutoHeight: true,

        // Initialize collections, models and JointJS graph
        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);

            this.$el = $(this.el);
            this.graph = new joint.dia.Graph;
            this.paper = new joint.dia.Paper({
                el: this.$el,
                width: 800,
                height: 600,
                model: this.graph,
                gridSize: 10
            });
            this.paper.on('cell:pointerclick', this._cellClicked, this);
            this.paper.$el.on('mousewheel DOMMouseScroll', { ctx: this }, this._mouseWheel);

            this.resultModel = new ResultModel();
            this.resultModel.setFromSplunkD({});
            this.searchJobModel = new SearchJobModel();
            this.searchReportModel = new SearchReportModel();

            this.workflowActionsCollection = new WorkflowActionsCollection();
            this.workflowActionsCollection.fetch({
              data: {
                      app: sharedModels.get("app").get("app"),
                      owner: sharedModels.get("app").get("owner"),
                      count: -1,
                      search: $.param({disabled: 0}),
                      sort_key: "name"
              },
              success: _.bind(function() {
                      this._isWorkflowActionsCollectionReady = true;
                      console.info("workflow actions loaded");
              }, this)
            });

            // fix window resize not calling reflow
            var that = this;
            $(window).resize(function (e) { that.invalidateReflow() });
        },

        // Build Colormaps
        _getColor: function(data) {
            // Check for empty data
            if (data.rows.length < 1) {
              return false;
            }

            var domain = this.colorCategories;
            var range = [this.okColor, this.warnColor, this.errColor];

            if (this.useColors) {
              if (this.colorMode === 'categorical') {
                //Splunk Categorical Color Scheme

                this.color = d3.scale.ordinal()
                    .domain(domain)
                    .range(range);
              } else {
                //Sequential Color Scheme

                // Looking for min/max value in 'data' third colum
                var min = Infinity, max = -Infinity;
                damain = [];
                $.each(data.rows, function(idx, nodeArr) {
                  var currentVal = Number(nodeArr[2]);
                  if (currentVal < min) min = currentVal;
                  if (currentVal > max) max = currentVal;
                  domain.push(currentVal);
                });

                var interpolateNum = d3.interpolateRound(min, max);
                var interpolateColor = d3.interpolateHcl(this.minColor, this.maxColor); //Rgb, Hcl, Hsl
                var colorDomain = [];
                var colorRange = [];

                for (var x=0; x < this.numOfBins; x++) {
                    colorDomain.push(interpolateNum(x/(this.numOfBins-1)));
                    colorRange.push(interpolateColor(x/(this.numOfBins-1)));
                }

                this.color = d3.scale.ordinal()
                               .domain(colorDomain)
                               .range(colorRange);
              }
            } else {
              //No colors - only use first categorical color
              this.colorMode = 'categorical';
              this.color = d3.scale.ordinal()
                          .domain(domain)
                          .range(['#1e93c6']);
            }
        },

        // Escape HTML entities
        _getEscapedProperty: function(name, config) {
            var propertyValue = config[this.getPropertyNamespaceInfo().propertyNamespace + name];
            return (vizUtils.escapeHtml(propertyValue));
        },

        // Get vizualisation properties
        _getConfigParams: function(config) {
            //Custom Color Handling
            this.useColors = genUtils.normalizeBoolean(this._getEscapedProperty('useColors', config), { default: true });
            this.colorMode = this._getEscapedProperty('colorMode', config) || this.colorMode;
            this.minColor = this._getEscapedProperty('minColor', config) || this.minColor;
            this.maxColor = this._getEscapedProperty('maxColor', config) || this.maxColor;
            this.okColor = this._getEscapedProperty('okColor', config) || this.okColor;
            this.warnColor = this._getEscapedProperty('warnColor', config) || this.warnColor;
            this.errColor = this._getEscapedProperty('errColor', config) || this.errColor;
            this.numOfBins = this._getEscapedProperty('numOfBins', config) || this.numOfBins;
            this.drilldownBehavior = this._getEscapedProperty('drilldownBehavior', config) || this.drilldownBehavior;
            this.drilldownValue = this._getEscapedProperty('drilldownValue', config) || this.drilldownValue;
            this.drilldownToken = this._getEscapedProperty('drilldownToken', config) || this.drilldownToken;
            this.direction = this._getEscapedProperty('direction', config) || this.direction;
            this.scale = this._getEscapedProperty('scale', config) || this.scale;
            this.useMouseScale = genUtils.normalizeBoolean(this._getEscapedProperty('useMouseScale', config), { default: false });
            this.useAutoHeight = genUtils.normalizeBoolean(this._getEscapedProperty('useAutoHeight', config), { default: true });
        },

        // Graph auto-layout
        _autoLayout: function() {
            // create a first layout to caculate how much space it takes
            var prebuild = joint.layout.DirectedGraph.layout(this.graph, {
              rankDir: this.direction,
              marginX: 5,
              marginY: 5,
              nodeSep: 50,
            });
            // second layout "centered"
            joint.layout.DirectedGraph.layout(this.graph, {
              rankDir: this.direction,
              marginX: 5,
              marginY: 5,
              nodeSep: 50,
              vizWidth: this.$el.width(),
              prepWidth: prebuild.width,
              prepHeight: prebuild.height,
              setPosition: function(cell, position) {
                  xOrigin = (this.vizWidth / 2) - (this.prepWidth / 2);
                  cell.set('position', { x: xOrigin + (position.x - position.width / 2), y: position.y - position.height / 2 });
              }
            });
            if (this.useAutoHeight) {
              this.paper.setDimensions(this.$el.parent().width(), prebuild.height+10);
            } else {
              this.paper.setDimensions(this.$el.parent().width(), this.$el.parent().height());
            }
            this.paper.update();
        },

        _cellClicked: function(cellView, evt, x, y) {
          // Define which field/value to use for drilldown
          var fieldName, fieldValue;
          if (this.drilldownValue == "value") {
            fieldName = cellView.model.attributes.resultName;
            fieldValue = cellView.model.attributes.resultValue;
          } else {
            fieldName = cellView.model.attributes.fieldName;
            fieldValue = cellView.model.attributes.fieldValue;
          }
          
          // 3 drilldown behaviors:
          // - workflow actions
          // - set custom token
          // - to search
          if (this.drilldownBehavior == "workflow")
          { 
            this.fieldActions = new CustomWorkflowActionsView({
              model: {
                  event: this.resultModel.results.models[0],
                  searchJob: this.searchJobModel, 
                  report: this.searchReportModel,
                  result: this.resultModel,
                  application: sharedModels.get("app")
               },
               collection: this.workflowActionsCollection,
               field: {
                   'name': fieldName,
                   'value': fieldValue
               },
               mode: 'menu',
               fieldName: fieldName,
               fieldValue: fieldValue
            });
            this.fieldActions.render().appendTo($('body')).show(cellView.$el);
          }
          else if (this.drilldownBehavior == "token")
          {
            mvc.Components.get("default").set(this.drilldownToken, fieldValue);
            mvc.Components.get('submitted').set(this.drilldownToken, fieldValue);

            // set 'form.' tokens to update form fields views
            mvc.Components.get("default").set("form."+this.drilldownToken, fieldValue);
            mvc.Components.get('submitted').set("form."+this.drilldownToken, fieldValue);
          }
          else if (this.drilldownBehavior == "search")
          {
            var data = {};
            data[fieldName] = fieldValue;
            this.drilldown({
              action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
              data: data
            }, evt);
          }
        },
 
        _makeShape: function(label, fillColor, fieldName, fieldValue, resultName, resultValue) {
          var maxLineLength = _.max(label.split('\n'), function(l) { return l.length; }).length;

          // Compute width/height of the rectangle based on the number 
          // of lines in the label and the letter size. 0.6 * letterSize is
          // an approximation of the monospace font letter width.
          var letterSize = 12;
          var width = 2 * (letterSize * (0.4 * maxLineLength + 1));
          width = width < 100 ? 100 : width;
          var height = 1.5 * ((label.split('\n').length + 1) * letterSize);

          return new joint.shapes.basic.Rect({
              id: label,
              size: { width: width, height: height },
              attrs: {
                  text: {
                      text: label,
                      fill: 'white',
                      'font-size': letterSize,
                      'font-family': 'monospace'
                  },
                  rect: {
                      fill: fillColor,
                      width: width, height: height,
                      rx: 5, ry: 5,
                      stroke: '#000000',
                      'stroke-width': 1
                  }
              },
              fieldName: fieldName,
              fieldValue: fieldValue,
              resultName: resultName,
              resultValue: resultValue
          });
        },
 
        // Process search results
        formatData: function(data, config) {

          // Check for empty data
          if (data.rows.length < 1) {
            return false;
          }

          this.resultModel.setFromSplunkD({results: data});

          // Field names
          var sourceFieldName = data.fields[0].name;
          var targetFieldName = data.fields[1].name;
          var measureOneName = data.fields[2].name;

          // Update 'this' with vizualisation config and coloring groups
          this._getConfigParams(config);
          this._getColor(data);

          // Coloring function made in '_getColor'
          var colorFunc = this.color; 
          var that = this;
          // Iterate through 'data.rows' while accumulating JointJS shapes and links
          var accumulator = data.rows.reduce(function(context, currentRow) {
            var from = currentRow[0],
                to   = currentRow[1] ? currentRow[1] : "undefined",
                val  = currentRow[2];

            // Make sure 'from' node is in the results.
            if (!context.objMap[from]) {
              context.objMap[from] = that._makeShape(from, colorFunc(val), sourceFieldName, from, measureOneName, val);
            } // Update 'from' node with higher 'val'
            else if (Number(context.objMap[from].attributes.resultValue) < Number(val)) {
              context.objMap[from].attributes.resultValue = val; 
              context.objMap[from].prop('attrs/rect/fill', colorFunc(val)); 
            }

            // Make sure 'to' node is in the results.
            if (!context.objMap[to]) {
              context.objMap[to] = that._makeShape(to, colorFunc(val), sourceFieldName, to, measureOneName, val);
            }

            // Create link between 'from' and 'to'
            var CustomLink = joint.dia.Link.extend({
              markup: '<path class="connection" stroke="gray" fill="none"/><path class="marker-target"/><path class="marker-source"/>'
            });
            var link = new CustomLink({
              source: { id: context.objMap[from].id },
              target: { id: context.objMap[to].id },
              router: { name: 'manhattan', args: { }},
              attrs: {
                '.connection': { stroke: 'gray' },
                '.marker-target': { fill: 'gray', d: 'M 10 0 L 0 5 L 10 10 z' }
              },
              args: {
                padding: 60
              }
            });
            // Populate result with 'joint.dia.Link' objects
            context.results.links.push(link);
            
            return (context);
          }, {
            results: {
              nodes:[],
              links:[]
            },
            objMap: {}
          });

          // Populate result with 'jointjs.shapes.basic.Rect' objects only
          $.each(accumulator.objMap, function(idx, obj) {
            accumulator.results.nodes.push(obj);
          });
          return (accumulator.results);
        },
 
        // Display/Resize JointJS Graph + trigger auto-layout 
        updateView: function(data, config) {
          if (!data.nodes)
              return;
          this.data = data;
          this.graph.clear();
          this.graph.addCells([data.nodes, data.links]);
          this.invalidateReflow();
        },

        // Resize JointJS Graph + auto-layout
        reflow: function() {
          this._autoLayout();           
          this._updateLinks();
          
          // set scale
          this.paper.setOrigin(0, 0);
          this.paper.scale(this.scale, this.scale, this.paper.$el.width()/2, this.paper.$el.height()/2);

          // Panel div as of Splunk Custom Viz API 6.6-7.0
          this.panelDiv = $(this.el).parent().parent().parent().parent().parent();
          this.panelDiv.css("height", this.paper.$el.height());
        },

        // Search data params
        getInitialDataParams: function() {
          return ({
            outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
            count: 10000
          });
        },

        // Trigger links view update to prevent layout overlap between nodes and links
        _updateLinks: function() {
          if (!this.data)
            return;
          var that = this;
          $.each(that.data.links, function(idx, link) {
            that.paper.findViewByModel(link).update();
          });
        },

        _offsetToLocalPoint: function(x, y) {
          var svgPoint = this.paper.svg.createSVGPoint();
          svgPoint.x = x;
          svgPoint.y = y;

          var pointTransformed = svgPoint.matrixTransform(this.paper.viewport.getCTM().inverse());
          return pointTransformed;
        },

        _mouseWheel: function(e) {
          self = e.data.ctx;
          if (!self.useMouseScale)
            return;
          e.preventDefault();
          e = e.originalEvent;

          var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail))) / 50;
          var offsetX = (e.offsetX || e.clientX - $(self.el).offset().left);

          var offsetY = (e.offsetY || e.clientY - $(self.el).offset().top);
          var p = self._offsetToLocalPoint(offsetX, offsetY);
          var newScale = self.paper.scale().sx + delta;
          if (newScale > 0.4 && newScale < 2) {
            self.paper.setOrigin(0, 0);
            self.paper.scale(newScale, newScale, p.x, p.y);
          }
        }
  });
});

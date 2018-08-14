define(function(require, exports, module) {
  var _ = require('underscore');
  var WorkflowActionsView = require('views/shared/eventsviewer/shared/WorkflowActions');

  return WorkflowActionsView.extend({
    initialize: function(options) {
      this.hactions = {};
      if (options && _.has(options, 'hactions')) {
        _.extend(this.hactions, options.hactions);
      }
      WorkflowActionsView.prototype.initialize.apply(this, arguments);

      this.notableEventSuppressions = options.notableEventSuppressions || [];
    },

    events: _.extend({}, WorkflowActionsView.prototype.events, {
      'click a.actions': function(e) {
        var data = $(e.target).data(),
          model = this.collection.at(data.idx),
          content = this.getTransformedAttrs(this.collection.at(data.idx)),
          re = /^#/;

        if (_.isString(content['link.method']) && content['link.method'].toLowerCase() === 'get' ) {
        	if (content['link.uri'].match(re) !== null) {
        		data.type = "hashbang";
                content.e = e;
        	} else if (content['link.ir_override'] && content['link.ir_override'].match(re)) {
        		data.type = "hashbang";
                content.e = e;
                content['link.uri'] = content['link.ir_override'];
        	}
        } 
          
        this[data.type](content, data.target);

        e.preventDefault();
      }
    }),

    hashbang: function(content, target) {
      var uri = content['link.uri'],
        hash = uri.slice(1).split("/"),
        action = hash[0];

      if (_.has(this.hactions, action) && _.isFunction(this.hactions[action])) {
        this.hactions[hash].call(this, content, _.rest(hash));
      }

      return false;
    },

    setHashAction: function(hash, callback) {
      if (_.isString(hash) && _.isFunction(callback)) {
        this.hactions[hash] = callback;
      }
    },

    template: '\
      <ul>\
         <% var i = 0, len = actions.length %>\
         <% for(i; i<len; i++) { %>\
             <% var attrs = getTransformedAttrs.call(that, collection.at(actions[i])); %>\
             <li>\
                 <a class="actions" href="#" data-target="<%- "_"+(attrs["link.target"] || attrs["search.target"]) %>" data-idx="<%- that.actions[i] %>" data-type="<%-attrs["type"] %>"><%- _(trim(attrs["label"], 100)).t() %></a>\
             </li>\
         <% } %>\
      </ul>'
});
});

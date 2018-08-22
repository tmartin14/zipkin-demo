# jointjs_diagram_app - Custom Vizualisation to display directed graphs.

**Powered by JointJS. See http://jointjs.com/opensource**

This Custom Viz uses several Javascript libraries bundled together using
Webpack:
  
  * webpack 1.12.6 - MIT
  * jquery 2.2.0 - MIT
  * underscore 1.8.3 - MIT
  * lodash 3.10.1 - JS Foundation, MIT, CreativeCommons 1.0
  * dagre 0.7.4 - MIT
  * graphlib 2.1.1 - MIT
  * jointjs 1.0.1 - MPL v2.0
  * d3 3.5.16 - BSD

Please refer to sources or corresponding project's websites for licenses terms.

Integration was made following documentation; see:
https://docs.splunk.com/Documentation/Splunk/6.5/AdvancedDev/CustomVizTutorial

## Known issues

  * DirectedGraph layout doesn't work with self-refering links (ie: from == to)
  * Layout refresh triggers JointJS cells translation (moving effect)
  * ... probably more to come ...

## General consideration

This vizualisation requires at least 3 result fields.
Field names are irrelevant.

## Coloring options

Coloring is based on the third result field.

  * **Categorical**: 3 predefined ranges: success, warning, error.
                 Colors can be changed in Viz options.
  * **Sequential**:  Numeric values can be split in color bins.
                 Color range can be defined in Viz options.
  * **None**:        Defaults to a beautiful navy blue.

## Drilldown options

**"Token" option:**
  You can define token name in Viz options.
  Token value can either be 'Node Name' (result field 1 or 2) or
  'Node Value' (result field 3).

**"Workflow" option:**
  You can use **workflow_actions.conf** using "display_location = field_menu".
  Field name and value can either be 'Node Name' (result field 1 or 2) or
  'Node Value' (result field 3).

  See documentation:
  https://docs.splunk.com/Documentation/Splunk/latest/Admin/Workflow_actionsconf

**"Search" option:**
  Drilldown to search using either 'Node Name' (result field 1 or 2) or
  'Node Value' (result field 3) as filter.

**"None"**:
  No drilldown.

## Changelog
**Breakfix 1.0.1**
- Compatibility with Splunk 6.4 CustomViz API

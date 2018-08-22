var webpack = require('webpack');
var path = require('path');

module.exports = {
    entry: 'jointjs_diagram',
    resolve: {
        root: [
            path.join(__dirname, 'src'),
        ]
    },
    output: {
        filename: 'visualization.js',
        libraryTarget: 'amd'
    },
    externals: [
        'splunkjs/mvc',
        'util/general_utils',
        'models/search/Job',
        'models/search/Report',
        'models/services/search/jobs/Result',
        'vizapi/SplunkVisualizationBase',
        'vizapi/SplunkVisualizationUtils',
        'splunkjs/mvc/sharedmodels',
        'collections/services/data/ui/WorkflowActions',
        'views/shared/eventsviewer/shared/WorkflowActions'
    ]
};

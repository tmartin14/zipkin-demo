var webpack = require('webpack');
var path = require('path');

module.exports = {
    entry: 'timeline',
    resolve: {
        root: [
            path.join(__dirname, 'src'),
        ]
    },
    output: {
        filename: 'visualization.js',
        libraryTarget: 'amd'
    },
    module: {
        loaders: [
            {
                test: /d3-timeline\.js$/,
                loader: 'imports-loader?d3=d3'
            },
            { test: /tooltip/, loader: 'imports?jQuery=jquery' }
        ]
    },
    externals: [
        'api/SplunkVisualizationBase',
        'api/SplunkVisualizationUtils'
    ]
};
module.exports = function (grunt) {
    var js_files = ['Gruntfile.js', 'lib/**/*.js', 'test/**/*.js'];

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish')
            },
            all: js_files
        },
        watch: {
            files: js_files,
            tasks: ['jshint']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['watch']);
    grunt.registerTask('test', ['']);
};

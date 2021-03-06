/*
 * grunt-assets-versioning
 * https://github.com/theasta/grunt-assets-versioning
 *
 * Copyright (c) 2013 Alexandrine Boissière
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');

require('./processors/date');
require('./processors/hash');

module.exports = function(grunt) {

  var getVersionProcessor = function (type) {
    return require('./processors/' + type);
  };

  grunt.registerMultiTask('assets_versioning', 'Version static assets', function() {

    var done = this.async();

    var options = this.options({
      use: 'hash',
      hashLength: 8,
      encoding: 'utf8',
      dateFormat: 'YYYYMMDDHHmmss',
      timezoneOffset: 0,
      outputTrimDir: '',
      rename: function(destPath, rev) {
        return path.dirname(destPath) + path.sep + path.basename(destPath, path.extname(destPath)) + '.' + rev + path.extname(destPath);
      },
      output: null,
      skipExisting: true,
      multitask: false,
      multitaskTarget: this.target,
      runTask: true
    });

    if (['hash', 'date'].indexOf(options.use) === -1) {
      grunt.fail.warn('Invalid argument : options.use should be equal to date or hash', 1);
    }

    var revFiles = [];
    var output = [];
    var taskFiles;
    var surrogateTask;
    var surrogateTaskConfigKey;
    var taskConfig;
    var targetTaskConfigKey = this.name + '.' + this.target;
    var targetTask = this.name + ':' + this.target;
    var isExternalTaskMode = !!options.multitask;

    if (isExternalTaskMode) {

      grunt.log.debug('External Task Mode');

      targetTaskConfigKey = options.multitask + '.' + options.multitaskTarget;
      targetTask = options.multitask + ':' + options.multitaskTarget;
      grunt.log.writeln("Versioning files from " + targetTask + " task.");

      surrogateTask = options.multitask + ':' + options.multitaskTarget + '_' + this.name;
      surrogateTaskConfigKey = targetTaskConfigKey + '_' + this.name;
      grunt.log.debug("Surrogate task: " + surrogateTask);

      taskConfig = grunt.config.get(targetTaskConfigKey);

      if (!taskConfig) {
        grunt.fail.warn("Task " + targetTask + " doesn't exist or doesn't have any configuration. It can't be versioned.", 1);
      }

      // In surrogate task mode, there should not be any 'files' property
      if (this.data.files != null) {
        grunt.fail.warn("In external task mode, files passed directly to the assets_versioning task won't be processed. Instead, the task is going to version files from the target task: " + targetTask);
      }

      // retrieve files from the target task
      taskFiles = grunt.task.normalizeMultiTaskFiles(taskConfig, this.target);

    } else {

      grunt.log.debug('Internal Task Mode');

      grunt.log.debug("Versioning files passed directly to " + targetTask + " task.");
      taskFiles = this.files;

    }

    if (!taskFiles || taskFiles.length === 0) {
      grunt.fail.warn("Task doesn't have any src-dest file mappings.", 1);
    }

    taskFiles.forEach(function(f) {

      var rev;
      var destFilePath;
      var src = f.src.filter(function (file) {
        return grunt.file.isFile(file);
      });

      if (src.length === 0) {
        grunt.log.error('src is an empty array');
        return false;
      }

      rev = getVersionProcessor(options.use)(src, options);
      grunt.log.debug('Version tag: ' + rev);

      if (rev === '') {
        grunt.fail.warn("Failed at generating a version tag for " + f.dest, 1);
        return false;
      }

      destFilePath = options.rename.call(this, f.dest, rev);
      grunt.log.debug('Destination filename: ' + rev);

      if (options.output) {
        output.push({
          rev: rev,
          path: f.dest.replace(options.outputTrimDir, ''),
          revved_path: destFilePath.replace(options.outputTrimDir, '')
        });
      }

      // check if file already exists
      if (options.skipExisting === true) {
        grunt.log.debug('options.skipExisting is true, checking if destination file already exists.');
        if (grunt.file.exists(destFilePath)) {
          return false;
        }
      }

      // log the src and dest data
      revFiles.push({ src: src, dest: destFilePath });

    });

    if (options.output) {
      grunt.file.write(options.output, JSON.stringify(output));
    }

    grunt.config.set(this.name + '.' + this.target + '.revFiles', revFiles);

    // run surrogate task if defined
    if (isExternalTaskMode) {

      // remove src & dest keys as they take precedence over the files key
      delete taskConfig.src;
      delete taskConfig.dest;
      taskConfig.files = revFiles;
      grunt.config.set(surrogateTaskConfigKey, taskConfig);

      if (options.runTask) {
        grunt.task.run(surrogateTask);
      }

    } else {

      revFiles.forEach(function (fRev) {

        var content = fRev.src.map(function (filepath) {
          return grunt.file.read(filepath);
        }).join(grunt.util.linefeed);

        grunt.file.write(fRev.dest, content);

        grunt.log.writeln('File ' + fRev.dest + ' created.');

      });

    }

    done();

  });

};


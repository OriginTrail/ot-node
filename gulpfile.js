const gulp = require('gulp');
const beautify = require('gulp-beautify');
const eslint = require('gulp-eslint');

gulp.task('make-origintrail-great-again', function () {
	gulp.src('./**/*.js')
		.pipe(beautify({
			indent_size: 2
		}))
		.pipe(eslint({
			fix: true
		}))
		.pipe(gulp.dest('./'));
});

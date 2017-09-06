const promiseUtil = require('../src/index.js');
const chai = require('chai');
const assert = chai.assert;

let i = 0;

function getSomething(req) {
  return new Promise((resolve, reject) => {
    setTimeout(function() {
      i++;
      if (i % 5 === 3 || i % 5 === 4) {
        return reject(new Error('cannot get something'));
      } else {
        return resolve(i);
      }
    }, getRandomArbitary(40, 100));
  }).then(i => {
    console.log(req, ' => ', i);
    return i;
  }).catch(e => {
    console.log(req, ' => ', e.message);
    return Promise.reject(e);
  });
}

function getRandomArbitary(min, max) {
  return Math.random() * (max - min) + min;
}

const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const toPromise = (req, i) => getSomething(req);

describe('promise-util', function() {
  this.timeout(1000 * 10);
  describe('#batch()', function() {
    it('should work in minimal', function() {
      return promiseUtil.batch([], () => Promise.resolve());
    });
    it('should return correct results', function() {
      return promiseUtil.batch([5, 6, 7], (req, index) => Promise.resolve([req, index])).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });
    it('should return correct error', function() {
      return promiseUtil.batch([5], _ => Promise.reject(0)).then(_ => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
        assert.deepEqual(e.errors, [0]);
        assert.deepEqual(e.unprocessedRequests, [5]);
      });
    });
    it('should work', function() {
      return promiseUtil.batch(requests, toPromise, {
        interval: 10,
        retry: {
          count: 2,
          interval: 100
        }
      }).then(results => {
        console.log(results);
      }).catch(e => {
        console.error('Error:', e.message);
        console.error('Unprocessed:', e.unprocessedRequests);
      });
    });
  });
  describe('#parallel()', function() {
    it('should handle empty requests', function() {
      return promiseUtil.parallel([], () => Promise.resolve());
    });
    it('should return correct results', function() {
      return promiseUtil.parallel([5, 6, 7], (req, index) => Promise.resolve([req, index])).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });
    it('should return correct error', function() {
      return promiseUtil.parallel([5], _ => Promise.reject(0)).then(_ => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
        assert.deepEqual(e.errors, [0]);
        assert.deepEqual(e.unprocessedRequests, [5]);
      });
    });
    it('should work', function() {
      return promiseUtil.parallel(requests, toPromise, {
        limit: 3
      }).then(results => {
        console.log(results);
      }).catch(e => {
        console.error('Error:', e.message);
        console.error('Errors:', e.errors.map(e => e.message));
        console.error('Unprocessed:', e.unprocessedRequests);
      });
    });
  });
});

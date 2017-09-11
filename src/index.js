function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function parallel(requests, toPromise, options) {
  options = options || {};
  const interval = 0;
  const retryCount = (options.retry && typeof options.retry.count === 'number') ? options.retry.count : options.retry || 0;
  const retryInterval = (options.retry && typeof options.retry.interval === 'number') ? options.retry.interval : 0;
  const limit = options.limit || null;
  const shouldRetry = (options.retry && typeof options.retry.shouldRetry === 'function') ? options.retry.shouldRetry : (e => true);
  const reqInfoList = requests.map((req, i) => {
    return {
      index: i,
      request: req,
      ok: false,
      result: undefined,
      errors: [],
    };
  });
  const stack = reqInfoList.concat();
  let count = 0;
  let stopRequest = false;
  let retriedCount = 0;
  let lastRequestTime = null;

  function loop(resolve) {
    while (true) {
      if (stopRequest || (limit && count >= limit) || stack.length === 0) {
        break;
      }
      const reqInfo = stack.shift();
      count++;
      const requestTime = Date.now();
      const waitTime = lastRequestTime ? Math.max(0, lastRequestTime + interval - requestTime) : 0;
      const wait = waitTime ? delay(waitTime) : Promise.resolve();
      wait.then(_ => toPromise(reqInfo.request, reqInfo.index)).then(result => {
        reqInfo.result = result;
        reqInfo.ok = true;
        reqInfo.errors.length = 0;
      }).catch(e => {
        reqInfo.errors.push(e);
        if (shouldRetry(e)) {
          stack.unshift(reqInfo);
        }
        stopRequest = true;
      }).then(_ => {
        count--;
        loop(resolve);
      });
      lastRequestTime = requestTime;
    }
    if (stopRequest && count === 0) {
      if (stack.length > 0 && retriedCount < retryCount) {
        const wait = (typeof retryInterval === 'number') ? delay(retryInterval) : Promise.resolve();
        wait.then(_ => {
          stopRequest = false;
          retriedCount++;
          loop(resolve);
        });
      } else {
        resolve();
      }
    } else if (stack.length === 0 && count === 0) {
      resolve();
    }
  }
  return new Promise(loop).then(_ => {
    const results = [];
    const errors = [];
    const unprocessed = [];
    for (let i = 0; i < reqInfoList.length; i++) {
      const reqInfo = reqInfoList[i];
      if (reqInfo.errors.length > 0) {
        const err = new Error(`Tried ${reqInfo.errors.length} times but could not get successful result. ` + formatErrorMessages(reqInfo.errors));
        err.errors = reqInfo.errors;
        errors.push(err);
      } else {
        results.push(reqInfo.result);
      }
      if (!reqInfo.ok) {
        unprocessed.push(reqInfo.request);
      }
    }
    if (errors.length) {
      const err = new Error('Some requests are unprocessed.');
      err.errors = errors;
      err.unprocessedRequests = unprocessed;
      return Promise.reject(err);
    }
    return results;
  });
}

function batch2(requests, toPromise, options) {
  return parallel(requests, toPromise, Object.assign({
    limit: 1
  }, options))
}

function formatErrorMessages(errors) {
  return errors.map(formatErrorMessage).join(' ');
}

function formatErrorMessage(e, i) {
  return '[' + (i + 1) + '] ' + (e ? e.message || JSON.stringify(e) : '');
}

module.exports = {
  delay: delay,
  batch: batch2,
  parallel: parallel
};

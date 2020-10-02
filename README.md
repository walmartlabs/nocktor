***
# NOTICE:
 
## This repository has been archived and is not supported.
 
[![No Maintenance Intended](http://unmaintained.tech/badge.svg)](http://unmaintained.tech/)
***

Nocktor
====
(Nock doctor)

A prescription for using Nock's recording capabilities to heal your tests' ailing mock data. Use Nocktor to create a single set of tests that can be run in `live`, `record` or `replay` mode. This library applies functional testing best practices from @walmartlabs to provide a simple API for recording and replaying mock data.

[![Build Status](https://travis-ci.org/walmartlabs/nocktor.svg?branch=master)](https://travis-ci.org/walmartlabs/nocktor)

## Install
```
npm install @walmartlabs/nocktor
```

## Example

```js
// api.spec.js
'use strict';

const nocktor = require('@walmartlabs/nocktor');
const dir = path.join(__dirname, 'recorded-data');

// Module we want to test that makes HTTP requests
const api = require('../lib/api');

describe('Api Tests', () => {
  // Ensure recorder is cleaned up
  afterEach(() => nocktor.reset());

  describe('api#fetchUsers()')
    it('should fetch users from the api', () => {
      nocktor.start(dir, 'api-fetch-users-happy-path');

      return api.fetchUsers()
        .then((response) => {
          assert(response.statusCode === 200, 'Response status code is not `200`');
        })
        .then(() => nocktor.stop());
    });
  });
});
```

```sh
# Test spec against live API
NOCKTOR_MODE=live mocha ./test/api.spec.js --grep "api#fetchUsers()"
# Test spec against live API, while recording responses to disk
NOCKTOR_MODE=record mocha ./test/api.spec.js --grep "api#fetchUsers()"
# Test spec against recorded responses
NOCKTOR_MODE=replay mocha ./test/api.spec.js --grep "api#fetchUsers()"
# Track recorded responses (mocks) in version control
git a ./test/recorded-data/api-fetch-users-happy-path-records.json
```

## API

_Note:_ Since nock's record functionality inherently affects global state, the `start` and `stop` methods below are inherently stateful.

#### `nocktor.start(dir: string, tag: string, options: object)`

Starts behavior for given mode, defined as:

Live mode: Do nothing
Record mode: Initiate nock recorder
Replay mode: Load existing nock records

Must call `nocktor.stop()` before calling `nocktor.start()` again.

`dir: string`: Path to directory which contains all recorded nocks

`tag: string`: Unique tag which will be used to generate filename for record

`options.mode: ['replay'|'record'|'live']`: Overrides the default mode. Default mode is `replay`, unless overriden by the environment variable `NOCKTOR_MODE`.

`options.recordReqHeaders: boolean`: Used in `record` mode. If true, tells nock to record request headers. Off be default, since request headers often include timestamps.

`options.redefine: function`: Used in `replay` mode. Runs for each record retrieved from filesystem before being loaded into nock. Useful is there are fields in the persisted record you need to modify/remove (like headers with timestamps). Return a falsey value to skip a record altogether.

#### `nocktor.stop()`

Saves recording if we are in record mode and marks the current run as over.

Will throw an error if no run is ongoing.

Calls `nocktor.reset()` internally.

#### `nocktor.reset()`

Resets nock state & state of recorder.

#### `nocktor.getMode()`

Get the recorder mode.

Returns the mode uses for the current run if we're in a recording.
Throws an exception if the recorder is not started.

#### `nocktor.getModesEnum()`

Returns an object containing the available modes to run Nocktor in:
```
{
  REPLAY: "replay",
  LIVE: "live",
  RECORD: "record",
  DEFAULT: "replay"
}
```

#### `nocktor.nock`

Reference to the instance of Nock used internally.
See warning below for why you might want this.

## Warning: Don't mock yourself

Nocktor is a very convenient abstraction, but it does allow for a dangerous anti-pattern in your tests.
Nocktor records **all** requests made while it is running.
If Nocktor is recording when a request is made from test code to your API, then that request/response will be recorded as well.
This means that `replay` mode will mock the request from your test code to your API, thus you will not actually exercise your API.
Here is an example:

```
describe("Users API", () => {
  it ("responds with expected users", () => {
    nocktor.start(mockDir, "users-happy-path");
    requestPromise("localhost:8080/users")
      .then((response) => {
        // response here will be mocked by nock
        ...
      });
  });
});
```

#### What to do?

There are a couple of options:

1. Tell Nock to allow requests to your API to pass through.
```
const nocktor = require('@walmartlabs/nocktor');
describe("Users API", () => {
  it ("responds with expected users", () => {
    nocktor.start(mockDir, "users-happy-path");
    nocktor.nock.enableNetConnect(/localhost/);
    requestPromise("localhost:8080/users")
      .then((response) => {
        ...
      });
  });
});
```
2. If you use Hapi, use `server.inject` instead of making network requests to your API.
```
const nocktor = require('@walmartlabs/nocktor');
describe("Users API", () => {
  it ("responds with expected users", () => {
    nocktor.start(mockDir, "users-happy-path");
    server.injectThen("/users") // assumes that inject has been promisified.
      .then((response) => {
        ...
      });
  });
});
```

## But Why?

You might ask "Nock already records and plays back, so what does Nocktor provide"?

Nock provides us with a rich syntax for intercepting HTTP requests, but little guidance on best practices. Nocktor reduces the complexity of instrumenting tests with nock by reducing the API to 3 intuitive method calls; **start**, **stop**, and **reset**.

For more complex request flows the user may still access nock directly so there's nothing lost by abstracting the interface. These 3 simple method calls enforce a development pattern for our tests that allows us to always run against representative and refreshable data. This helps ensure our tests do not run against stale or otherwise innacurate mock data and saves developer time from having to handcraft stubs. Moreover we gain a strong guarantee our tests will work in a live setting because we can regularly run them against live services.

Nocktor introduces little functionality of its own, but provides a set of useful helper functions that reduce boilerplate and dictate test design patterns that have proven quite successful for us.

Finally, Nock is just much more pleasant to use with Nocktor - or at least that is what we have found at WalmartLabs!

## Attributions
This module was born inside @walmartlabs, and commit history was wiped out when we ported it to a public module.
These following engineers worked very hard on this module, and they should get credit for it.

### Ian Walker Sperber (@ianwsperber) -
Original inventor and author of this module. Also a contributor to Nock.

### Christopher Crewdson (@chriscrewdson) -
Current co-maintainer and responsible for porting this library for public use.

### Kyle Schatler (@kschat) -
Past contributor when this module was internal

### Kevin Stephens (@kevinmstephens) -
Past contributor when this module was internal

### Steve Slayden (@steveslayden) -
Past contributor when this module was internal

### Dylan Wood (@dylancwood) -
Current co-maintainer and responsible for bringing this library to the public

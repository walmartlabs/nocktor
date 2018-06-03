Nocktor
====
(Nock doctor)

A prescription for using Nock's recording capabilities to heal your tests' ailing mock data. Use Nocktor to create a single set of tests that can be run in `live`, `record` or `replay` mode. This library applies functional testing best practices from @walmartlabs to provide a simple API for recording and replaying mock data.

## Example

```js
// api.spec.js
'use strict';

const recorder = require('@walmart/nocktor');
const dir = path.join(__dirname, 'recorded-data');

// Module we want to test that makes HTTP requests
const api = require('../lib/api');

describe('Api Tests', () => {
  // Ensure recorder is cleaned up
  afterEach(() => recorder.reset());

  describe('api#fetchUsers()')
    it('should fetch users from the api', () => {
      recorder.start(dir, 'api-fetch-users-happy-path');

      return api.fetchUsers()
        .then((response) => {
          assert(response.statusCode === 200, 'Response status code is not `200`');
        })
        .then(() => recorder.stop());
    });
  });
});
```

```sh
# Test spec against live API
NOCK_RECORDER=live mocha ./test/api.spec.js --grep "api#fetchUsers()"
# Test spec against live API, while recording responses to disk
NOCK_RECORDER=record mocha ./test/api.spec.js --grep "api#fetchUsers()"
# Test spec against recorded responses
NOCK_RECORDER=replay mocha ./test/api.spec.js --grep "api#fetchUsers()"
# Track recorded responses (mocks) in version control
git a ./test/recorded-data/api-fetch-users-happy-path-records.json
```

## API

_Note:_ Since nock's record functionality inherently affects global state, the `start` and `stop` methods below are inherently stateful.

#### `recorder.start(dir: string, tag: string, options: object)`

Starts behavior for given mode, defined as:

Live mode: Do nothing
Record mode: Initiate nock recorder
Replay mode: Load existing nock records

Must call `recorder.stop()` before calling `recorder.start()` again.

`dir: string`: Path to directory which contains all recorded nocks

`tag: string`: Unique tag which will be used to generate filename for record

`options.mode: ['replay'|'record'|'live']`: Overrides the default mode. Default mode is `replay`, unless overriden by the environment variables `NOCK_RECORDER` or `TEST_MODE`.

`options.recordReqHeaders: boolean`: Used in `record` mode. If true, tells nock to record request headers. Off be default, since request headers often include timestamps.

`options.redefine: function`: Used in `replay` mode. Runs for each record retrieved from filesystem before being loaded into nock. Useful is there are fields in the persisted record you need to modify/remove (like headers with timestamps). Return a falsey value to skip a record altogether.

#### `recorder.stop()`

Saves recording if we are in record mode and marks the current run as over.

Will throw an error if no run is ongoing.

Calls `recorder.reset()` internally.

#### `recorder.reset()`

Resets nock state & state of recorder.

#### `recorder.mode()`

Get the recorder mode.

Returns the mode uses for the current run if we're in a recording. Returns the current default mode otherwise.

## But Why?

You might ask "Nock already records and plays back, so what does Nocktor provide"?

Nock provides us with a rich syntax for intercepting HTTP requests, but little guidance on best practices. Nocktor reduces the complexity of instrumenting tests with nock by reducing the API to 3 intuitive method calls; **start**, **stop**, and **reset**.

For more complex request flows the user may still access nock directly so there's nothing lost by abstracting the interface. These 3 simple method calls enforce a development pattern for our tests that allows us to always run against representative and refreshable data. This helps ensure our tests do not run against stale or otherwise innacurate mock data and saves developer time from having to handcraft stubs. Moreover we gain a strong guarantee our tests will work in a live setting because we can regularly run them against live services.

Nocktor introduces little functionality of its own, but provides a set of useful helper functions that reduce boilerplate and dictate test design patterns that have proven quite successful for us.

Finally, Nock is just much more pleasant to use with Nocktor - or at least that is what we have found at WalmartLabs!

## Attributions
This module was born inside @walmartlabs, and commit history was wiped out when we ported it to a public module.
These fine engineers worked very hard on this module, and they should get credit for it.

### Ian Walker Sperber (@ianwsperber) -
Original inventor and author of this module. Also a contributor to Nock.

### Christopher Crewdson (@chriscrewdson) -
Current maintainer and responsible for porting this library for public use.

### Kyle Schatler (@kschat) -
Past contributor when this module was internal

### Kevin Stephens (@kevinmstephens) -
Past contributor when this module was internal

### Steve Slayden (@steveslayden) -
Past contributor when this module was internal

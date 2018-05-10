/**
 * Copyright (c) [2018]-present, Walmart Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License."
 */

"use strict";

const nock = require("nock");
const path = require("path");
const fs = require("fs");
const assert = require("assert");

const REPLAY_MODE = "replay";
const LIVE_MODE = "live";
const RECORD_MODE = "record";

module.exports.RECORD_MODE = RECORD_MODE;
module.exports.LIVE_MODE = LIVE_MODE;
module.exports.REPLAY_MODE = REPLAY_MODE;

const state = {
  running: false,
  mode: null,
  stop: null
};

const getRecordFilename = (dir, tag) => {
  const clean = tag.replace(/\s+/g, "-").toLowerCase();

  return path.join(dir, `${clean}-records.json`);
};

const record = recordReqHeaders => {
  nock.recorder.clear();

  // Will throw an error if we're already recording
  nock.recorder.rec({
    /* eslint-disable camelcase */
    output_objects: true,
    dont_print: true,
    enable_reqheaders_recording: recordReqHeaders
    /* eslint-enable camelcase */
  });
};

const replay = (dir, tag, redefine) => {
  let nockDefs;

  try {
    nockDefs = nock.loadDefs(getRecordFilename(dir, tag));
  } catch (err) {
    // eslint-disable-next-line max-len
    err.message = `Nock recorder failure - could not load definitions. Have you created a recording yet?\n\n${err.message}`;
    throw err;
  }

  if (redefine) {
    nockDefs = nockDefs.map(redefine).filter(d => d);
  }

  return nock.define(nockDefs);
};

const stop = () => {
  if (state.running && state.stop) {
    return state.stop();
  }

  if (state.running && !state.stop) {
    // eslint-disable-next-line max-len
    throw new Error("Nock recorder failure - unexpected recording without having set stop method");
  }

  // eslint-disable-next-line max-len
  throw new Error("Nock recorder failure - can\'t stop, nock recorder is not running!");
};

const reset = () => {
  Object.keys(state).forEach(key => {
    state[key] = null;
  });
  state.running = false;

  nock.enableNetConnect();
  nock.cleanAll();
  nock.restore();
  nock.activate();
};

const modeByEnv = () => process.env.NOCK_RECORDER || process.env.TEST_MODE || REPLAY_MODE;

const mode = () => state.mode || modeByEnv();

/**
 * Start nock behavior
 *
 * @param  {string} dir Data directory
 * @param  {string} tag Recording tag
 * @param  {Object} opts Options
 * @param  {Boolean} opts.recordReqHeaders Enable request headers recording
 * @param  {Function} opts.redefine Redefine nock definitions for replay
 * @return {object[]}  Loaded nocks if available
 */
const start = (dir, tag, opts) => {
  const options = opts || {};
  assert(dir, "Missing tag data directory");
  assert(tag, "Missing tag name");

  assert(!state.running, "Nock recorder already running");

  state.running = true;
  state.mode = options.mode || modeByEnv();
  let nocks;

  // Safety check
  nock.enableNetConnect();

  if (state.mode === RECORD_MODE) {
    record(options.recordReqHeaders);
  } else if (state.mode !== LIVE_MODE) { // Unknown modes run as replay
    nock.disableNetConnect(); // Ensure we are not allowing requests unexpectedly
    nocks = replay(dir, tag, options.redefine);
  }

  state.stop = () => {
    const records = nock.recorder.play();
    const stateMode = state.mode;
    reset();

    if (stateMode !== RECORD_MODE) {
      return null;
    }

    try {
      const numberOfSpacesInJson = 2;
      const filename = getRecordFilename(dir, tag);
      const stringified = JSON.stringify(records, null, numberOfSpacesInJson);

      fs.writeFileSync(filename, stringified);
    } catch (err) {
      // eslint-disable-next-line max-len
      err.message = `Nock recorder failure - failed to persist nock records: ${err.message}`;
      throw err;
    }

    return records;
  };

  return nocks;
};

module.exports = {
  start,
  stop,
  reset,
  mode
};

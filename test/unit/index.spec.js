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

/* eslint-disable max-nested-callbacks */
/* eslint-disable max-statements */

const nock = require("nock");
const path = require("path");
const fs = require("fs");
const rp = require("request-promise");
const expect = require("chai").expect;
const mockServerBuilder = require("../mock-server-builder");

// System Under Test
const recorder = require("../../");

const dir = path.join(__dirname, "recorded-data"); // eslint-disable-line no-undef

const LIVE_TIMEOUT = 5000;

describe("Nocktor", () => {
  let requests;
  let mockServer;

  const buildRequestsList = mockServerBaseUrl => {
    return [{
      uri: `${mockServerBaseUrl}/endpoint1`,
      method: "GET",
      json: true,
      resolveWithFullResponse: true
    }, {
      uri: `${mockServerBaseUrl}/endpoint2`,
      method: "POST",
      json: true,
      resolveWithFullResponse: true,
      body: {
        someKey: "some value"
      }
    }];
  };

  const rpIgnoreRateLimit = opts => {
    return rp(opts)
      .catch(err => {
        if (err.statusCode === 403) {
          return err.response;
        }

        throw err;
      });
  };

  const throwNth = n => err => {
    if (!err.n) {
      err.n = n;
      err.message = `Attempt #${n} failed: ${err.message}`;
    }

    throw err;
  };

  before(() => {
    return mockServerBuilder.buildMockServer()
      .then(buildResult => {
        mockServer = buildResult.server;
        requests = buildRequestsList(`http://${buildResult.address}:${buildResult.port}`);
      });
  });

  beforeEach(() => {
    delete process.env.NOCK_RECORDER;
    delete process.env.TEST_MODE;
  });

  after(() => {
    return new Promise(resolve => {
      mockServer.close(() => {
        resolve();
      });
    });
  });

  afterEach(() => {
    recorder.reset();
  });

  describe("replay mode @unit", () => {
    const simpleTestReplay = () => {
      recorder.start(dir, "replay-tests", { mode: "replay" });

      // Replay requests should match what is in the static file
      const replayRequests = buildRequestsList("http://127.0.0.1:50000");

      return Promise.all(replayRequests.map(rpIgnoreRateLimit))
        .then(responses => {
          responses.forEach((response, id) => {
            expect(response.body).to.eql({
              // Contents in our static file
              id,
              replay: true
            });
          });
        })
        .then(recorder.stop);
    };

    it("should play back our recorded data", () => {
      return simpleTestReplay();
    });

    it("should work across consecutive replays", () => {
      return simpleTestReplay()
        .catch(throwNth(1))
        .then(() => simpleTestReplay())
        .catch(throwNth(2))
        .then(() => simpleTestReplay())
        .catch(throwNth(3));
    });
  });

  describe("record mode @live", function () {
    // eslint-disable-next-line no-invalid-this
    this.timeout(LIVE_TIMEOUT);

    const tempDir = path.join(dir, "temp");
    const RECORDED_FILE = path.join(tempDir, "record-tests-records.json");

    beforeEach(() => fs.writeFileSync(RECORDED_FILE, ""));

    const assertRecordsReturnedAndRecorded = records => {
      expect(records, "Correct number of records").to.have.lengthOf(2);

      records.forEach((record, i) => {
        const uri = `${record.scope}${record.path}`;

        expect(
          requests.findIndex(req => req.uri === uri),
          `Record ${i} URL mismatch`
        ).to.be.greaterThan(-1);
        expect(requests.find(req => req.uri === uri).method).to.eql(record.method);
      });

      // If throws, invalid JSON
      const recordedRecords = JSON.parse(fs.readFileSync(RECORDED_FILE));
      expect(recordedRecords).to.eql(records);
    };

    const simpleTestRecord = () => {
      recorder.start(tempDir, "record-tests", { mode: "record" });

      return Promise.all(requests.map(rpIgnoreRateLimit))
        .then(recorder.stop)
        .then(assertRecordsReturnedAndRecorded);
    };

    it("should record our request", () => {
      expect(fs.readFileSync(RECORDED_FILE).toString()).to.equal("");

      return simpleTestRecord();
    });

    it("should work across consecutive recordings", () => {
      return simpleTestRecord()
        .catch(throwNth(1))
        .then(() => simpleTestRecord())
        .catch(throwNth(2))
        .then(() => simpleTestRecord())
        .catch(throwNth(3));
    });
  });

  describe("live mode @live", function () {
    // eslint-disable-next-line no-invalid-this
    this.timeout(LIVE_TIMEOUT);

    it("should make a live request", () => {
      recorder.start(dir, "live-tests", { mode: "live" });

      return Promise.all(requests.map(rpIgnoreRateLimit))
        .then(responses => {
          responses.forEach(response => {
            expect(
              response.headers,
              "Missing 'date' header. GH api may have changed"
            ).to.have.property("date");

            const time = new Date(response.headers.date).getTime();
            expect(isNaN(time)).to.equal(false);
            expect(time, "Response is contemporary").to.be.closeTo(Date.now(), LIVE_TIMEOUT);
          });
        })
        .then(recorder.stop);
    });
  });

  describe("recorder#start() @unit", () => {
    it("will throw an error if the recorder has already been started", () => {
      recorder.start(dir, "foo");
      expect(() => recorder.start(dir, "foo")).to.throw(/Nocktor already running/);
    });

    it("will throw an error if started with invalid mode", () => {
      expect(() => recorder.start(dir, "foo", { mode: "foo" }))
        .to
        .throw(/Nocktor failure - unexpected mode 'foo'/);
    });
  });

  describe("recorder#stop() @unit", () => {
    it("will throw an error if the recorder has not been started", () => {
      expect(() => recorder.stop()).to.throw(/can\'t stop, Nocktor is not running/);
    });
  });

  describe("recorder#reset()", () => {
    it("is cancels ongoing recordings @live", () => {
      recorder.start(dir, "reset-cancels-record", { mode: "record" });
      recorder.reset();

      return Promise.all(requests.map(rpIgnoreRateLimit))
        .then(() => {
          expect(nock.recorder.play()).to.have.lengthOf(0);
        });
    });

    it("sets `recorder#stop` back to the default @unit", () => {
      recorder.start(dir, "foo");
      recorder.reset();

      expect(() => recorder.stop()).to.throw(/can\'t stop, Nocktor is not running/);
    });

    it("enables one to call `recorder.start()` again @unit", () => {
      recorder.start(dir, "foo");
      recorder.reset();
      recorder.start(dir, "foo");
    });
  });

  describe("recorder#mode() @unit", () => {
    it("should return the active mode if running", () => {
      ["live", "replay", "record"].forEach(mode => {
        recorder.start(dir, "foo", { mode });
        expect(recorder.mode()).to.equal(mode);
        recorder.stop();
        recorder.start(dir, "foo");
        expect(recorder.mode(), "Mode returns to default").to.equal("replay");
        recorder.stop();
      });
    });

    it("should return the value of $NOCKTOR_MODE if set", () => {
      ["live", "replay", "record"].forEach(mode => {
        process.env.NOCKTOR_MODE = mode;

        recorder.start(dir, "foo");
        expect(recorder.mode()).to.equal(mode);

        recorder.stop();
        recorder.start(dir, "foo", { mode: "live" });
        expect(recorder.mode(), "Active mode overrides defaults").to.equal("live");

        recorder.stop();
        delete process.env.NOCKTOR_MODE;

        recorder.start(dir, "foo");
        expect(recorder.mode(), "Mode returns to default").to.equal("replay");
        recorder.stop();

      });
    });

    it("should default to 'replay'", () => {
      delete process.env.NOCKTOR_MODE;

      recorder.start(dir, "foo");
      expect(recorder.mode()).to.equal("replay");
      recorder.stop();
    });

    it("should throw if not running", () => {
      delete process.env.NOCKTOR_MODE;
      expect(recorder.mode).to.throw(/Nocktor failure - attempt to access mode/);
    });
  });

  describe("recorder#getModesEnum() @unit", () => {
    it("returns object of available modes", () => {
      expect(recorder.getModesEnum()).to.eql({
        REPLAY: "replay",
        LIVE: "live",
        RECORD: "record",
        DEFAULT: "replay"
      });
    });

    it("returns a copy of the object used internally (not a ref)", () => {
      const modesOne = recorder.getModesEnum();
      const modesTwo = recorder.getModesEnum();

      expect(modesOne).to.not.equal(modesTwo);
    });
  });
});

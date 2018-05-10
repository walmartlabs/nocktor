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

const http = require("http");

const hostname = "127.0.0.1";

const requestHandler = (request, response) => {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json");
  response.end(`{"request":{"method":"${encodeURIComponent(request.method)}","url":"${encodeURIComponent(request.url)}"}}`);
};

const buildMockServer = () => {
  return new Promise(resolve => {
    const server = http.createServer(requestHandler);

    // try a random unassigned port and resolve the server on "listening" event
    server.listen(0, hostname, () => resolve(server));
  })
    .then(server => {
      const serverAddress = server.address();
      console.log(`mock-server running at http://${serverAddress.address}:${serverAddress.port}/`); // eslint-disable-line no-console

      return { port: serverAddress.port, address: serverAddress.address, server };
    });
};

module.exports = {
  buildMockServer
};

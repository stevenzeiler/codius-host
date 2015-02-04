//------------------------------------------------------------------------------
/*
    This file is part of Codius: https://github.com/codius
    Copyright (c) 2014 Ripple Labs Inc.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose  with  or without fee is hereby granted, provided that the above
    copyright notice and this permission notice appear in all copies.

    THE  SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
    WITH  REGARD  TO  THIS  SOFTWARE  INCLUDING  ALL  IMPLIED  WARRANTIES  OF
    MERCHANTABILITY  AND  FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
    ANY  SPECIAL ,  DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
    WHATSOEVER  RESULTING  FROM  LOSS  OF USE, DATA OR PROFITS, WHETHER IN AN
    ACTION  OF  CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
    OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
//==============================================================================

var winston = require('winston');
var chalk = require('chalk');
var Promise = require('bluebird');

var formatter = require('./formatter');
var engine    = require('./engine');
var config    = require('./config');
var features  = require('./features');

var Token = require('../models/token').model;

/**
 * Class that handles incoming connections and
 * bills tokens for their running time
 *
 * @param {Integer} opts.pollInterval
 * @param {Integer} opts.millisecondsPerComputeUnit
 */
function Proxy (opts) {
  var self = this;

  if (!opts) {
    opts = {};
  }

  self._uniqueRunId = 0;
  self._runningInstances = {};
}

/**
 * Pass the incoming stream either to an existing contract instance
 * or create a new instance if there isn't one already and the token
 * has more than the minimum balance
 */
Proxy.prototype.handleConnection = function (token, stream) {
  var self = this;

  var runId = self._uniqueRunId++;

  // TODO: handle the error created when the stream is closed
  // because the contract is killed due to a low balance
  stream.on('error', function(error){
    winston.debug(contractIdent, chalk.dim('+++'), 'Stream error: ' + error.message);
  });

  new Token({token: token}).fetch({withRelated: ['contract', 'balance']}).then(function (model) {
    if (!model) {
      // TODO: Handle error somehow
    } else {
      var contractHash = model.related('contract').get('hash');
      var contractToken = model.get('token');
      var tokenBalance = model.related('balance').get('balance');

      var contractIdent = formatter.hash(contractHash) + chalk.dim(':' + runId);

      winston.debug(contractIdent, chalk.dim('+++'), 'Incoming connection');

      function run(hash, token) {
        //console.log('RUN', hash, token);
        runner = engine.engine.runContract(hash);

        // TODO: modify the engine and sandbox to make this work
        // runner._sandbox.pipeStdout({
        //   write: function (output) {
        //     // TODO Redirect to a stream that clients can subscribe to
        //     winston.debug(contractIdent, chalk.dim('...'),output.replace(/\n$/, ''));
        //   }
        // });
        self._runningInstances[token] = {
          runner: runner
        };

        // If the contract exits by itself, update its balance
        // and then remove it from the runningInstances array
        runner.on('exit', function (code, signal) {
          self.chargeToken(token).then(function(){
            delete self._runningInstances[token];
          });
        });
      }

      // Start the contract if there is no currently running instance yet
      var runner = self._runningInstances[contractToken];

      if (features.isEnabled('BILLING_GENERIC') && (tokenBalance < self._minBalance)) {
        return winston.debug(contractIdent, chalk.dim('+++'), 'Insufficient balance in token "'+token+'" to start contract');
      } else {
        run(contractHash, contractToken)
      }

      var listener;
      if (listener = runner.getPortListener(engine.engineConfig.virtual_port)) {
        listener(stream);
      } else {
        function handleListener(event) {
          if (event.port !== engine.engineConfig.virtual_port) return;

          runner.removeListener('portListener', handleListener);

          // Pass socket stream to contract
          event.listener(stream);
        }
        runner.on('portListener', handleListener);
      }

      // TODO: Why does this not get triggered?
      stream.on('end', function () {
        winston.debug(contractIdent, chalk.dim('---'), 'Connection ended');
      });
    }
  });
};

exports.Proxy = Proxy;


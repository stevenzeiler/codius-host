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
var path     = require('path');
var tokenLib = require(path.join(__dirname, '/../lib/token'));

var Token    = require(path.join(__dirname, '/../models/token')).model;
var Contract = require(path.join(__dirname, '/../models/contract')).model;
var Balance  = require(path.join(__dirname, '/../models/balance')).model;
var BillingService = require(path.join(__dirname, '/../lib/billing_service'));
var engine   = require(path.join(__dirname, '/../lib/engine'));

/**
 * Request a token.
 *
 * A token is a multi-use endpoint for interacting with a contract via HTTP.
 */
module.exports = function (req, res) {
  var config = req.app.get('config');

  function getUniqueToken() {
    var token = tokenLib.generateToken();

    return new Token({token: token}).fetch().then(function (model) {
      if (model !== null) {
        return getUniqueToken();
      } else return token;
    });
  }

  // First we check if the contract actually exists
  new Contract({hash: req.query.contract}).fetch().then(function (contract) {
    if (!contract) {
      // Contract doesn't exist
      res.status(400).json({
        message: "Unknown contract hash"
      });
    } else {
      // TODO: clean up this mess of returns
      return getUniqueToken().then(function (token) {
        return Token.forge({token: token, contract_id: contract.get('id')}).save().then(function(token){
          if (config.get('starting_cpu_balance') > 0) {
            return new BillingService().credit(token, config.get('starting_cpu_balance')).then(function() {
              return token;
            });
          } else return token;
        });
      }).then(function (token) {
        // All done!
        res.status(200).json({
          token: token.get('token')
        });
      });
    }
  });
};

var Promise = require('bluebird')

module.exports = function(codius) {

  var billing = new codius.BillingService();

  function getToken(token) {
    return new codius.Token({ token: token }).fetch()
      .then(function(token) {
        if (token) {
          return Promise.resolve(token)
        } else {
          return Promise.reject(new Error('token not found'))
        }
      })
  }

  return {
    create: function(req, res, next) {
      getToken(req.params.token).then(function(token) {
<<<<<<< HEAD
        billing.debit(token, req.body.amount)
=======
        return billing.debit(token, req.body.amount)
>>>>>>> 6f4ab268abbf5d0265bd8b6f0743ac9e228b9fa0
          .then(function(debit) {
            return token.getBalance().then(function(balance) {
              res.send({
                success: true,
<<<<<<< HEAD
 		balance: balance.get('balance'),
                debit: debit
	      })
=======
                balance: balance.get('balance'),
                debit: debit
              })
>>>>>>> 6f4ab268abbf5d0265bd8b6f0743ac9e228b9fa0
            })
          })
      }) 
      .error(next)
    },

    index: function(req, res, next) {
      getToken(req.params.token).then(function(token) {
        return billing.getDebits(token).then(function(debits) {
          res.status(200).send({
            success: true,
            debits: debits
          })
        })
      }) 
      .error(next)
    }
  }
}


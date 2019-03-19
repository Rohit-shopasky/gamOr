"use strict";

const fetch   = require('node-fetch');
const async   = require('async');

var url, urlAuth;

if (process.env.NODE_ENV === 'production') {
    url = 'http://data.hasura';
    urlAuth = 'http://auth.hasura';
} else {
    headers.Authorization = 'Bearer qcmil4a8e8alhwptlkvaldvca5hx4yhv';
    headerUser.Authorization = 'Bearer qcmil4a8e8alhwptlkvaldvca5hx4yhv';
    url = 'https://data.gamor-dev.hasura-app.io';
    urlAuth = 'https://auth.gamor-dev.hasura-app.io';
}

const request = (url, options, res, cb) => {
  fetch(url, options)
    .then(
      (response) => {
        let status = {
            code    : response.status,
            status  : response.ok,
            message : response.statusText
        };
        if (response.ok) {

          response
            .text()
            .then(d => {

              (cb(status, JSON.parse(d)));
            })
            .catch(e => {
                console.log("1");
              console.error(url, response.status, response.statusText);
              console.error(e, e.stack);
                let status = {
                    code    : response.status,
                    status  : false,
                    message : response.statusText
                };
                cb(status, '');
              res.status(500).send('Internal error');
            });
          return;
        }
        console.error(url, response.status, response.statusText);
        console.log("2");
        response.text().then(t => (console.log(t)));
        if (res) {
            let status = {
            code    : response.status,
            status  : false,
            message : response.statusText
        };
        cb(status, '');
          //res.status(500).send('Internal error');
        }
      }, (e) => {
        console.error(url, e);
        if (res) {
            console.log("3");
          res.status(500).send('Internal error');
        }
      })
    .catch(e => {
      console.error(url, e);
      console.error(e.stack);
      if (res) {
          console.log("4");
        res.status(500).send('Internal error');
      }
    });
};

module.exports = {
    select: (res, table, where, pagination, orderBy, headerUser, cb) => {
        let selectUrl = url + '/api/1/table/'+table+'/select';
        let body = { columns: ['*'] };

        if(where) body.where = where;

        if(orderBy) body.order_by= orderBy;

        if(pagination) {
            body.limit  = pagination.limit;
            body.offset = pagination.offset;
        }

        let selectOpts = {
            method  : 'POST',
            body    : JSON.stringify(body),
            headers : headerUser
        };

        request(selectUrl, selectOpts, res, (error, result) => {
            cb(error, result);
        });
    },

    update: (res, table, set, where, headerUser, cb) => {
        let updateUrl = url + '/api/1/table/'+table+'/update';

        let updateData = JSON.stringify({
            $set: set,
            where: where
        });

        let updateOpts = {
            method  : 'POST',
            body    : updateData,
            headers : headerUser
        };

        request(updateUrl, updateOpts, res, (error, data) => {
            cb(error, data);
        });
    },

    insert: (res, table, objects, headerUser, cb) => {
        let insertUrl   = url+'/api/1/table/'+table+'/insert';
        let insertOpts = {
            method  : 'POST',
            body    : JSON.stringify({ objects }),
            headers : headerUser
        };
        request(insertUrl, insertOpts, res, (error, data) => {
            cb(error, data);
        });
    },

    delete: (res, table, where, cb) => {
        var getUrl = url + '/v1/query';
        var getoptions = {
            method: 'POST',
            headers: {
                'x-hasura-role'   : 'admin',
                'X-Hasura-User-Id': 1,
                'content-type'    : 'application/json'
            },
            body: JSON.stringify({
                "type": "delete",
                "args": { table, where }
            })
        };
        request(getUrl, getoptions, res, (error, response) => {
            cb(error, response);
        });
    },
};
"use strict";
// load up the user model
var fetch   = require('node-fetch');
var moment   = require('moment');
var async = require('async');

//Required Files
const common      = require('./common');
const CRUD        = require('./CRUD');

const headers = {
  'Content-Type': 'application/json'
};

var url, urlAuth;
let headerUser = {
    'Content-Type'     : 'application/json'
};

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

let selectBalance = (res, where, orderColumn, headerUser, cb) => {
    let selectUrl   = url + '/api/1/table/user_balance/select';
    let selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where,
        order_by: [{
          column: orderColumn,
          order: 'desc'
        }]
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, balanceList) => {
        cb(status, balanceList)
    });
};

let selectUser = (res, where, headerUser, cb) => {
    var selectUrl   = url + '/api/1/table/user/select';

    var selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, users) => {

    let usersIds= users.map( user => user.id );
        common.getBadgeInformation(res, usersIds, headerUser, (status, badgeInformation) => {

            if(badgeInformation && badgeInformation.length) {
                users.forEach( user => {
                    if(user.profile_image_url && !(/https:/g).test(user.profile_image_url))
                        user.profile_image_url= common.imagePath() + user.profile_image_url;
                    user.badge= badgeInformation.find( badge => badge.user_id == user.id ) || null;
                });
            }

            cb(status, users);
        });
    });
};

module.exports = {
    ranking: (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let user_id = +req.query.user_id;
		var current_user_id = user_id;
        let type    = req.query.type;
        let where= {
            $or: [{
                user1: user_id
            }, {
                user2: user_id
            }]
        };
        CRUD.select(res, 'like', where, '', '', headerUser, (status, userLike) => {
            if(status.status === false) console.log(status);

            userLike.forEach(user => {
                if(user.user2 === user_id && user.status === "sent") user.status= "recieved";
            });

            selectBalance(res, {}, type, headerUser, (status, balanceList) => {
                //Getting array in descending order and slicing it to 10
				
                let topTen  = balanceList.sort( (a, b) => b[type] - a[type] ).slice(0, 10);

                let userRank = balanceList.findIndex( b => b.user_id == user_id) + 1;

                let userIds  = topTen.map( b => b.user_id);
                let where    = { id: {"$in": userIds} };
                let chunk, likeChunk;

                selectUser(res, where, headerUser, (status, users) => {
                    let i=1;
                    let rankList = topTen.map(t => {
                        chunk = users.find(u => u.id == t.user_id);
                        chunk.rank = i++;

                        likeChunk  = userLike.find(u => u.user1 == t.user_id || u.user2 == t.user_id);
                        
                        if(!likeChunk) likeChunk= {status: 'user'};
                        if(chunk.id === user_id) chunk.status= "friends"; 

                        delete chunk.password;
                        return Object.assign({}, likeChunk, t, chunk);
                    });
					
					var where = {user_id:current_user_id}
					selectBalance(res, where, type, headerUser,(status,current_user_balance)=>{
						var points = current_user_balance[0].points;
						var money  = current_user_balance[0].money;
						
						res.json({status, data: { userRank, rankList, points, money } });
					});
					
                    
                });
            });
        });
    },

    logs: (req, res) => {
        let user_id = +req.query.user_id;

        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        CRUD.select(res, 'logs', {user_id}, '', '', headerUser, (status, logs) => {
            res.json({status, data: logs });
        });
    }
};

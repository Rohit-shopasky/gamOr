"use strict";
// load up the user model
var moment   = require('moment');
var async = require('async');

const headers = {
  'Content-Type': 'application/json'
};

let headerUser = {
    'Content-Type' : 'application/json'
};

//Required Files
const CRUD          = require('./CRUD');
const common        = require('./common');
const notification  = require('./notifications');

const userResultByRankAndBalance= (res, userLike, type, user1, userIds, headerUser, cb) => {
	 // console.log("called resultBy..");
	  // console.log("userLike ->" +userLike + "type->" +type +  " user1->" +user1 + " userIds->" +userIds);
	// type -> points user1 -> 237
	
    let orderBy, chunk, userRank, data, likeChunk, where;
    orderBy= [{
        column: type,
        order: 'desc'
    }];
    where= { user_id: {"$in": userIds} };
    CRUD.select(res, 'user_balance', where, '', orderBy, headerUser, (status, balanceList) => {
		
		
        balanceList.sort( (a, b) => b[type] - a[type] );

        userRank = balanceList.findIndex( b => b.user_id == user1) + 1;   // user rank 0
         
        userIds  = balanceList.map( b => b.user_id);
                                                                         // userIds empty
        where= { id: {"$in": userIds} };
        CRUD.select(res, 'user', where, '', '', headerUser, (status, users) => {

            let usersIds= users.map( user => user.id );
            common.getBadgeInformation(res, usersIds, headerUser, (status, badgeInformation) => {
                     console.log("badgeInformation->");
					 console.log(badgeInformation);
                if(badgeInformation && badgeInformation.length) {
                    users.forEach( user => {
                        if(user.profile_image_url && !(/https:/g).test(user.profile_image_url))
                            user.profile_image_url= common.imagePath() + user.profile_image_url;
                        user.badge= badgeInformation.find( badge => badge.user_id == user.id ) || null;
                    });
                }

                let i=1;
                let rankList=[];
                balanceList.forEach(balance => {
                    chunk = users.find(u => u.id == balance.user_id);
                    chunk.rank = i++;
                    likeChunk  = userLike.find(u => u.user1 == balance.user_id || u.user2 == balance.user_id);

                    if(chunk.id === user1) chunk.status= "friends";

                    delete chunk.password;
                    rankList.push(Object.assign({}, likeChunk, balance, chunk));

                });
                cb(status, rankList, userRank);
            });
        });
    });
};

module.exports = {
    like: (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let where, orderBy, objects, set;
        let chunk = req.body;
        const user = {
            from: +chunk.user1,
            to: +chunk.user2
        };

        where= {
            $or: [{
                user1: user.from, user2: user.to
            }, {
                user1: user.to, user2: user.from
            }]
        };
        orderBy= [{
            column: 'timestamp',
            order: 'desc',
            nulls: 'last'
        }];
        CRUD.select(res, 'like', where, '', orderBy, headerUser, (status, alreadyLikedResult) => {
            let upsertUrl;
            let likeUpsert;
            console.log('alreadyLikedResult: ', alreadyLikedResult);
            if (alreadyLikedResult.length === 0) {
                console.log('inserting...');
                objects= [{
                    user1: user.from,
                    user2: user.to,
                    status: "sent"
                }];
                CRUD.insert(res, 'like', objects, headerUser, (status, data) => {
                    if(status.status === false) console.log(status);
                });
            }
            if( alreadyLikedResult.length === 1 ) {
                console.log('updating...');
                set= {
                    status: "friends",
                    timestamp: (new Date()).toISOString()
                };
                where= {
                    id: alreadyLikedResult[0].id
                }
                CRUD.update(res, 'like', set, where, headerUser, (status, data) => {
                    if(status.status === false) console.log(status);
                });
            }

            where= { id: user.from };
            CRUD.select(res, 'user', where, '', '', headerUser, (status, userResult) => {
                let notificationType, content;

                if (alreadyLikedResult.length === 0) {
                    notificationType = 'connection_request';
                    content = userResult[0].name +' has sent you a connection request.';
                }
                else {
                    notificationType = 'connection_established';
                    content =userResult[0].name +' is now a connection!';
                }

                //Function to Save new connection in the table
                notification.newConnectionRequest(res, user, notificationType, content, userResult, headerUser);
                res.json({ status, data:[] });
            });
        });
    },

    unfriend: (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let chunk = req.body;

        const user = {
            from: +chunk.user1,
            to: +chunk.user2
        };

        let where= {
            $and: [{
                user1: {"$in": [user.from, user.to]}
            }, {
                user2: {"$in": [user.from, user.to]}
            }]
        };
        CRUD.delete(res, 'like', where, (status, response) => {
            if(status.status == false) console.log(status);
            res.json({ status, data: response });
        });
    },

    rankingAmongFriends: (req, res) => {
         headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let user_id = +req.query.user_id;
		var current_user_id = user_id;
        let type    = req.query.type;

        let orderBy, userIds= [];
        let where= {
            $or: [{
                user1: user_id
            }, {
                user2: user_id
            }],
            status: "friends"
        };
        CRUD.select(res, 'like', where, '', '', headerUser, (status, userLike) => {
            if(status.status === false) console.log(status);
             //console.log(userLike);                // empty
			// console.log("user_id->" +user_id);    //237
            userLike.forEach(user => {
                if(!~userIds.indexOf(user.user1)) userIds.push(user.user1);
                if(!~userIds.indexOf(user.user2)) userIds.push(user.user2);
            });
              
            userResultByRankAndBalance(res, userLike, type, user_id, userIds, headerUser, (status, data, userRank) => {
				
				var where = {user_id:user_id};
				CRUD.select(res, 'user_balance', where, '', orderBy, headerUser, (status, balanceList) => {
					var points = balanceList[0].points;
					var money = balanceList[0].money;
					console.log(points + " " + money);
					res.json({ status, data: { userRank, rankList: data,points,money } });
					
				});
            });
        });
    },

    friendProfile: (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let user1 = +req.query.user1;
        let user2 = +req.query.user2;

        let orderBy, userIds= [], likeChunk;
        let where= {
            $or: [{
                user1: user1, user2: user2
            }, {
                user1: user2, user2: user1
            }]
        };
        CRUD.select(res, 'like', where, '', '', headerUser, (status, userLike) => {
            if(status) console.log(status);

            if(userLike.length) {
                userLike.forEach(user => {
                    if(!~userIds.indexOf(user.user1) && user.user1 !== user1) userIds.push(user.user1);
                    if(!~userIds.indexOf(user.user2) && user.user2 !== user1) userIds.push(user.user2);
                    if(user.user2 === user2 && user.status === "sent") user.status= "recieved";
                });
            }
            else {
                userLike= [{ user1, user2, status: "user" }];
                userIds= [user1, user2];
            }

            userResultByRankAndBalance(res, userLike, "points", user1, userIds, headerUser, (status, data) => {
                res.json({ status, data });
            });
        });
    },

    userLikes: (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let user_id = +req.query.user_id;

        let userIds= [];
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
                if(!~userIds.indexOf(user.user1) && user.user1 !==user_id) userIds.push(user.user1);
                if(!~userIds.indexOf(user.user2) && user.user2 !==user_id) userIds.push(user.user2);
                if(user.user2 === user_id && user.status === "sent") user.status= "recieved";
            });

            userResultByRankAndBalance(res, userLike, "points", user_id, userIds, headerUser, (status, data) => {
                res.json({ status, data });
            });
        });
    },

    gamorUsers: (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let user_id = +req.body.user_id || '';
        let emails  = req.body.emails || [];

        let orderBy, userIds= [], likeChunk;

        let where= {
            $or: [{
                "email": {"$in": emails}
            }, {
                "facebook_id": {"$in": emails}
            }, {
                "twitter_id": {"$in": emails}
            }, {
                "google_id": {"$in": emails}
            }]
        };;

        CRUD.select(res, 'user', where, '', '', headerUser, (status, users) => {

            userIds= users.map(u => u.id);

            common.getBadgeInformation(res, userIds, headerUser, (status, badgeInformation) => {
    
                if(badgeInformation && badgeInformation.length) {
                    users.forEach( user => {
                        if(user.profile_image_url && !(/https:/g).test(user.profile_image_url))
                            user.profile_image_url= common.imagePath() + user.profile_image_url;
                        user.badge= badgeInformation.find( badge => badge.user_id == user.id ) || null;
                    });
                }

                where= {
                    $or: [{
                        user1: user_id, user2: {"$in": userIds}
                    }, {
                        user1: {"$in": userIds}, user2: user_id
                    }]
                };
                CRUD.select(res, 'like', where, '', '', headerUser, (status, userLike) => {
                    if(status.status === false) console.log(status);

                    userLike.forEach(user => {
                        if(user.user2 === user_id && user.status === "sent") user.status= "recieved";
                    });

                    orderBy= [{
                        column: "points",
                        order: 'desc'
                    }];
                    where= { user_id: {"$in": userIds} };
                    CRUD.select(res, 'user_balance', where, '', orderBy, headerUser, (status, balanceList) => {
                        balanceList.sort( (a, b) => b.points - a.points );
                        let userIds  = balanceList.map( b => b.user_id);

                        let chunk, i=1;
                        let rankList = balanceList.map(balance => {
                            chunk = users.find(u => u.id == balance.user_id);
                            chunk.rank = i++;
                            likeChunk  = userLike.find(u => u.user1 == balance.user_id || u.user2 == balance.user_id);

                            if(!likeChunk) likeChunk= {status: 'user'};

                            delete chunk.password;
                            return Object.assign({}, likeChunk, balance, chunk);
                        });
                        res.json({status, data: rankList });
                    });
                });
            });
        });
    },

};
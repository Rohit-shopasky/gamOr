"use strict";
// load up Required Modules
const moment    = require('moment');
const async     = require('async');
const gcm       = require('node-gcm');
const nodemailer= require('nodemailer');

const headers = {
  'Content-Type': 'application/json'
};

let headerUser = {
    'Content-Type' : 'application/json'
};

//Required Files
const CRUD  = require('./CRUD');
const common= require('./common');

module.exports = {
    getNotifications: (req, res) => {
        let user_id = +req.query.user_id;
        let page    = +req.query.page;
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let set, where ={ user_id }, categoryIds= [], questionIds, questionChunks, userIds= [];
        let pagination = { limit: 10, offset: (page-1)*10 };

        let orderBy= [ { column: 'timestamp', type: 'desc' } ];
        CRUD.select(res, 'notification', where, pagination, orderBy, headerUser, (status, notificationList) => {
            if(status.status == false) console.log(status);

            if(notificationList.length) {

                where['is_read']= false;
                set = { 'is_read': true };
                CRUD.update(res, 'notification', set, where, headerUser, (status, updateResponse) => {
                    if(!status.status) console.log(JSON.stringify(status));

                    notificationList.forEach( n => {
                        if(n.category_id) categoryIds.push(n.category_id);
                        if(n.from_user_id) userIds.push(n.from_user_id);
                    });

                    where= { id: { "$in": userIds } };
                    CRUD.select(res, 'user', where, '', '', headerUser, (status, users) => {
                        if(status.status == false) console.log(status);

                        let usersIds= users.map( user => user.id );
                        common.getBadgeInformation(res, usersIds, headerUser, (status, badgeInformation) => {

                            users.forEach( user => {
                                user.badge= badgeInformation.find( badge => badge.user_id == user.id ) || null;
                                if(user.profile_image_url && !(/https:/g).test(user.profile_image_url))
                                    user.profile_image_url= common.imagePath() + user.profile_image_url;
                            });

                            where= { categories_id: { "$in": categoryIds } };
                            CRUD.select(res, 'categories', where, '', '', headerUser, (status, categories) => {
                                if(status.status == false) console.log(status);

                                let check_is_active= false;
                                common.getCategoriesWithPrediction(res, headerUser, categories, user_id, check_is_active, (err, categoriesListWithPredictions) => {
                                    if(err) console.log(err);
                                    else {
                                        where= { category_id: { "$in": categoryIds } };
                                        CRUD.select(res, 'question', where, '', '', headerUser, (status, questions) => {
                                            if(status.status == false) console.log(status);

                                            questionIds= questions.map( q => q.question_id );
                                            where= { question_id: { "$in": questionIds } };
                                            CRUD.select(res, 'user_answers', where, '', '', headerUser, (status, userAnswers) => {

                                                notificationList.forEach( n => {
                                                    n.userDetails= users.find( u => u.id === n.from_user_id ) || null;

                                                    n.categoryDetails= categoriesListWithPredictions.find( c => c.categories_id === n.category_id );

                                                    if(n.categoryDetails) {
                                                        questionChunks= questions.filter( q => q.category_id === n.categoryDetails.categories_id );
                                                        n.total_questions= questionChunks.length;

                                                        n.total_answers_out= questionChunks.reduce( (acc, cur) => acc + Boolean( cur.correct_option_id ), 0);

                                                        n.attempt_questions= userAnswers.reduce( (acc, cur) => acc + Boolean( questionChunks.find( qc => (qc.question_id === cur.question_id && cur.user_id === n.user_id) ) ), 0);
                                                    }
                                                });
                                                res.json({status, data: notificationList });
                                            });
                                        });
                                    }
                                });
                            });
                        });
                    });
                });
            }
            else res.json({status, data: notificationList });
        });
    },

    invite: (req, res) => {
        let user_id     = +req.body.user_id;
        let name        = req.body.name;
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let objects= [{
            user_id,
            content: "You Invited "+ name,
            type: 'invite',
        }];
        CRUD.insert(res, 'notification', objects, headerUser, (status, data) => {
            res.json({status, data });
        });
    },

    newConnectionRequest: (res, user, title, content, userResult, headerUser) => {
        let objects= [{
            user_id: user.to,
            from_user_id: user.from,
            type: title,
            content:content
        }];
        CRUD.insert(res, 'notification', objects, headerUser, (error, insertResponse) => {
            if(error) console.log(JSON.stringify(error));
            let where= {"user_id": user.to};

            CRUD.select(res, 'push_notification', where, '', '', headerUser, (status, notificationList) => {
                if(error) console.log(JSON.stringify(error));
                sendNotification([notificationList[0].notification_id], content, title, userResult, []);
            });
        });
    },

    contactUs: (req, res) => {
        let user_id = +req.body.user_id;
        let reason  = req.body.reason;

        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let where = {"id": user_id};
        CRUD.select(res, 'user', where, '', '', headerUser, (status, users) => {
            // create reusable transporter object using the default SMTP transport
            let transporter = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: 'suggestgamor@gmail.com',
                    pass: 'suggestgamo'
                }
            });

            //Prepare HTML body
            let html = "<b>Reason: </b>\
                        <h4>"+reason+"</h4>\
                        <h2>User Information:</h2>\
                        <table>\
                        <tr>\
                            <td>Name:</td>\
                            <td>"+users[0].name+"</td>\
                        </tr>\
                        <tr>\
                            <td>Email:</td>\
                            <td>"+users[0].email+"</td>\
                        </tr>\
                        <tr>\
                            <td>Phone:</td>\
                            <td>"+users[0].phone+"</td>\
                        </tr>\
                        </table>";

            // setup email data with unicode symbols
            let mailOptions = {
                from    : 'suggestgamor@gmail.com', // sender address
                to      : '80gamor@gmail.com, contact@bowstringstudio.in', // list of receivers
                subject : 'Contact Us', // Subject line
                text    : reason, // plain text body
                html    : html// html body
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.log(error);
                }
                console.log('Message %s sent: %s', info.messageId, info.response);
            });
        });
        let objects= [{ user_id, reason }];
        CRUD.insert(res, 'contact_us', objects, headerUser, (status, insertResponse) => {
            res.json({status, data: insertResponse });
        });
    },

    questionSuggestion: (req, res) => {
        let user_id = +req.body.user_id;
        let category= req.body.category;
        let question= req.body.question;
        let options = req.body.options;
        let comments= req.body.comments;

        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let where = {"id": user_id};
        CRUD.select(res, 'user', where, '', '', headerUser, (status, users) => {
            // create reusable transporter object using the default SMTP transport
            let transporter = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: 'suggestgamor@gmail.com',
                    pass: 'suggestgamo'
                }
            });

            //Prepare HTML body
            let html = "<b>Category: </b>\
                        <p>"+category+"</p>\
                        <b>Question: </b>\
                        <p>"+question+"</p>\
                        <b>Options: </b>\
                        <p>"+options+"</p>\
                        <b>Comments: </b>\
                        <p>"+comments+"</p>\
                        <h2>User Information:</h2>\
                        <table>\
                        <tr>\
                            <td>Name:</td>\
                            <td>"+users[0].name+"</td>\
                        </tr>\
                        <tr>\
                            <td>Email:</td>\
                            <td>"+users[0].email+"</td>\
                        </tr>\
                        <tr>\
                            <td>Phone:</td>\
                            <td>"+users[0].phone+"</td>\
                        </tr>\
                        </table>";

            // setup email data with unicode symbols
            let mailOptions = {
                from    : 'suggestgamor@gmail.com', // sender address
                to      : '80gamor@gmail.com, contact@bowstringstudio.in', // list of receivers
                subject : 'Question Suggestion', // Subject line
                text    : "Question Suggestion", // plain text body
                html    : html// html body
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.log(error);
                }
                console.log('Message %s sent: %s', info.messageId, info.response);
            });
        });
        let objects= [{ user_id, category, question, options, comments }];
        CRUD.insert(res, 'question_suggestions', objects, headerUser, (status, insertResponse) => {
            res.json({status, data: insertResponse });
        });
    }
};

function sendNotification(regTokens, content, type, user, category) {
    user= (user.length) ? user[0].id : '';
	
	title = ""
	switch (type) {
		case "new_connection":
		title = "New Connection Request"
		break
	}

    category= (category.length) ? category[0].categories_id : '';

    var sender = new gcm.Sender('AAAA9GfMWcU:APA91bFnBF4f72rd9fDUfRAjQVM5GwrKcINnUlV0NTiqNbAymun0KDKC5liDsFkzvWxgbhD6vv9g-9IdPqo6rCVLhsgYb1DgRH98xHVkegGiccmKLqgrnwBxQ6NLU_2hB6TCoYIyA6u7');
    var message = new gcm.Message({data: {message: content, "type": title, user, category},
    notification: {
        title: "gamOr",
        icon: "gamOr",
        body: content,
        otherProperty: true
    }});
    sender.send(message, { registrationTokens: regTokens }, function (err, response) {
        if (err) console.log(err);
        console.log(JSON.stringify(response));
    });
}
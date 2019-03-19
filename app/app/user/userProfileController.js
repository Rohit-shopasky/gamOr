"use strict";
// load up the user model
const fetch       = require('node-fetch');
const moment      = require('moment');
const nodemailer  = require('nodemailer');
const fs          = require("fs");
const crypto      = require("crypto");
const urlModule   = require('url');

const common = require('./common');
const crud = require('./CRUD');
const mailTempelate = require('./mailTempelate').toString();

const headers = {
  'Content-Type': 'application/json'
};

var url, urlAuth;
let headerUser = {
    'Content-Type'     : 'application/json',
    'X-Hasura-Role'    : 'admin',
    'X-Hasura-User-Id' : '1'
};

if (process.env.NODE_ENV === 'production') {
    url = 'http://data.hasura';
    urlAuth = 'http://auth.hasura';
} else {
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

let mainUsersave = (res, username, email, phone, password, cb) => {
    let insertUrl  = urlAuth + '/signup';
    let insertOpts = {
        method  : 'POST',
        body    : JSON.stringify({
            username    : username,
            email       : email,
            mobile      : phone,
            password    : password
        }),
        headers : headers
    };

    request(insertUrl, insertOpts, res, (status, sigupResponse) => {
        cb(status, sigupResponse);
    });
};

let userTableSave = (res, name, email, phone, username, password, social_media_type, social_media_value,
                     profile_image_url, cb) => {
    let insertUrl = url + '/api/1/table/user/insert';

    let obj = {
        name              : name,
        email             : email,
        phone             : phone,
        username          : username,
        password          : password,
        profile_image_url : profile_image_url,
        created_at        : common.todayByMoment()
    };

    if(social_media_type == 'facebook') obj['facebook_id'] = social_media_value;
    if(social_media_type == 'twitter')  obj['twitter_id'] = social_media_value;
    if(social_media_type == 'google')   obj['google_id'] = social_media_value;

    let insertOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        objects: [obj]
    }),
    headers : headerUser
    };

    request(insertUrl, insertOpts, res, (status, userResponse) => {
        cb(status, userResponse);
    });
};

let userTableSelect = (res, where, cb) => {
    var selectUrl   = url + '/api/1/table/user/select';

    var selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, userInformation) => {

        if(userInformation.length) {
            if(userInformation[0].profile_image_url && !(/https:/g).test(userInformation[0].profile_image_url))
                userInformation[0].profile_image_url= common.imagePath() + userInformation[0].profile_image_url;
            common.getBadgeInformation(res, [userInformation[0].id], headerUser, (status, badgeInformation) => {

                userInformation[0].badge= (badgeInformation && badgeInformation.length)
                    ? badgeInformation[0]
                    : null;

                cb(status, userInformation);
            });
        }
        else cb(status, userInformation);
    });
};

let notificationTableSelect = (res, where, cb) => {
    var selectUrl   = url + '/api/1/table/push_notification/select';

    var selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, objNotification) => {
        cb(status, objNotification);
    });
};

let noticeInsert = (res, insertObj, cb) => {
    var insertUrl       = url + '/api/1/table/push_notification/insert';
    var insertOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        objects: [insertObj]
    }),
    headers : headerUser
    };

    request(insertUrl, insertOpts, res, (status, pushresponse) => {
        cb(status, pushresponse);
    });
};

let updateNotificationTable = (res, set, where, cb) => {
    let updateUrl = url + '/api/1/table/push_notification/update';

    let updateData = JSON.stringify({
    $set: set,
    where: where
  });

    let updateOpts = {
    method  : 'POST',
    body    : updateData,
    headers : headerUser
  };

    request(updateUrl, updateOpts, res, (status, response) => {
        cb(status, response);
    });
};

let bakeResponse = (hasuraAuth, userInformation, objNotification, status, userBalance, cb) => {

    delete userInformation.password;
    userInformation['notification']  = objNotification;
    userInformation['userBalance']   = userBalance;

    if(hasuraAuth) {
        userInformation['Authorization'] = hasuraAuth.auth_token;
        userInformation['hasura_roles']  = hasuraAuth.hasura_roles[0];
        userInformation['hasura_id']     = hasuraAuth.hasura_id;
    }

    cb({data: userInformation, status: status});
};

let updateUserTable = (res, set, where, cb) => {
    let updateUrl = url + '/api/1/table/user/update';

    let updateData = JSON.stringify({
        $set: set,
        where: where
    });
    let updateOpts = {
        method  : 'POST',
        body    : updateData,
        headers : headerUser
    };
    request(updateUrl, updateOpts, res, (status, response) => {
        cb(status, response);
    });
};

let login = (res, userName, password, cb) => {
    var loginUrl = urlAuth + '/login';

    var loginOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        "username" : userName,
        "password" : password
    }),
    headers
    };

    request(loginUrl, loginOpts, res, (status, loginResponse) => {
        cb(status, loginResponse);
    });
};

let userBalanceInsert = (res, insertObj, cb) => {
    let where= {"user_id": insertObj.user_id};
    userBalanceSelect(res, where, (status, userBalance) => {

        if(userBalance && userBalance.length) cb(status, userBalance);
        else {
            var insertUrl       = url + '/api/1/table/user_balance/insert';
            var insertOpts = {
            method  : 'POST',
            body    : JSON.stringify({
                objects: [insertObj]
            }),
            headers : headerUser
            };

            request(insertUrl, insertOpts, res, (status, response) => {
                cb(status, response);
            });
        }
    });
};

let userBalanceSelect = (res, where, cb) => {
    var selectUrl   = url + '/api/1/table/user_balance/select';

    var selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, userBalance) => {
        cb(status, userBalance);
    });
};

function sendMail(html, email, subject, text) {
    let transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'suggestgamor@gmail.com',
            pass: 'suggestgamo'
        }
    });

    // setup email data with unicode symbols
    let mailOptions = {
        from    : '"gamOr - Support" <suggestgamor@gmail.com>', // sender address
        to      : email, // list of receivers
        subject,    // Subject line
        text,       // plain text body
        html        // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
    });
}

function htmlEscape(text) {
    return text.replace(/&/g, '&amp;').
      replace(/</g, '&lt;').  // it's not neccessary to escape >
      replace(/"/g, '&quot;').
      replace(/'/g, '&#039;');
}

function resetPasswordMail(userInformation, email, randomCrypticWord) {
    let resetLink= "https://panel.gamor-dev.hasura-app.io/admin/password/reset?u="+randomCrypticWord;
    let text= "Hi "+userInformation[0].name+", Link to Reset Password is: " + resetLink;

    let html= mailTempelate;
    html= html.replace("USER@NAME", userInformation[0].name);

    html= html.replace("LINK@RESET@PASSWORD", resetLink);
    sendMail(html, email, 'Reset Password', text);
}

function updateUserToken(res, email, user_token, done) {
    let set   = { user_token };
    let where = { email };

    updateUserTable(res, set, where, (status, updateResponse) => {
        done(status, updateResponse);
    });
}

module.exports = {

    login: (req, res) => {
		let password        = req.body.password;
        let notification_id = req.body.notification_id;
        let device_id       = req.body.device_id;
        let device_type     = req.body.device_type;
        let email           = req.body.email.toLowerCase();
		
        
        let mainPassword = email+"-gamor";

        login(res, email, mainPassword, (status, loginResponse) => {
                
            if(status.status === false) {
                status.message= "You need to signup before login";
                res.json({ status });
            }
            else {
                let where = { email };

                let objNotification = { notification_id, device_id, device_type, updated_at : common.todayByMoment() };

                userTableSelect(res, where, (userStatus, userInformation) => {
					
                   if(userInformation[0].password!="")
				   { 
                    if( userInformation.length === 0 || !common.validPassword(userInformation[0].password, password))
                    {  
                        let error= {
                            "code": 502,
                            "status": false,
                            "message": "Invalid credentials"
                        };
                        res.json({status: error});
                    }
                    else {
						   
                        where = { 'user_id' : Number(userInformation[0].id) };
                        updateNotificationTable(res, objNotification, where, (status, updateResponse) => {
                                                                        
                            notificationTableSelect(res, where, (status, objNotification) => {
                                                              
                                userBalanceSelect(res, where, (status, userBalanceResponse) => {

                                    bakeResponse(loginResponse, userInformation[0], objNotification, userStatus,
                                                 userBalanceResponse[0], (body) => {
													
                                        res.json(body);
                                    });
                                });
                            });
                        });
                    }
				  }	
				  else
				  {
					  var platform="";
					  if(!!userInformation[0].google_id) {platform="Google"}
					  else if(!!userInformation[0].facebook_id!='null')  {platform="Facebook"}
					  else if(!!userInformation[0].twitter_id!='null') {platform="Twitter"}
					  
					  var error_msg="You have already used this email to create an account using " +platform + ". Please login using " +platform + " or use a different email address."
					  
					   let error= {
                            "code": 502,
                            "status": false,
                            "message": error_msg
                        };
                        res.json({status: error});
				  }
                });
            }
        });
    
        },

    signupSocialMedia: (req, res) => {
		let name               = req.body.name;
        let email              = req.body.email.toLowerCase();
        let phone              = req.body.phone || '';
        let username           = req.body.username;
        let password           = '';
        let mainPassword       = email+"-gamor";
        let notification_id    = req.body.notification_id;
        let device_id          = req.body.device_id;
        let device_type        = req.body.device_type;
        let profile_image_url  = req.body.profile_image_url;
        let social_media_type  = req.body.social_media_type || undefined;
        let social_media_value = req.body.social_media_value || undefined;
        let where = { email };

        login(res, email, mainPassword, (status, loginResponse) => {
                
            if( status.status == true ) {
                let matchField;

                userTableSelect(res, where, (status, userInformation) => {
                    if(userInformation[0].password=="")
					{
                    var objNotification = {
                        notification_id : notification_id,
                        user_id         : userInformation[0].id,
                        device_id       : device_id,
                        device_type     : device_type,
                        updated_at      : common.todayByMoment()
                    };

                    where = { 'user_id' : Number(userInformation[0].id) };
                    updateNotificationTable(res, objNotification, where, (status, updateResponse) => {

                        notificationTableSelect(res, where, (status, objNotification) => {

                            userBalanceSelect(res, where, (status, userBalanceResponse) => {

                                if(social_media_type == 'facebook') matchField = userInformation[0].facebook_id;
                                if(social_media_type == 'twitter')  matchField = userInformation[0].twitter_id;
                                if(social_media_type == 'google')   matchField = userInformation[0].google_id;

                                if(matchField === social_media_value) {
                                    if(!userInformation[0].profile_image_url) {
                                        updateUserTable(res, { profile_image_url }, { email }, (s, r) => {

                                            userTableSelect(res, { email }, (status, userInformation) => {

                                                bakeResponse(loginResponse, userInformation[0], objNotification,
                                                             status, userBalanceResponse[0], (body) => {
                                                    res.json(body);
                                                });
                                            });
                                        });
                                    }
                                    else {
                                        bakeResponse(loginResponse, userInformation[0], objNotification, status,
                                                     userBalanceResponse[0], (body) => {

                                            res.json(body);
                                        });
                                    }
                                }
                                else {
                                    let set = {};
                                    if(social_media_type == 'facebook') set['facebook_id'] = social_media_value;
                                    if(social_media_type == 'twitter')  set['twitter_id'] = social_media_value;
                                    if(social_media_type == 'google')   set['google_id'] = social_media_value;

                                    where = { email };
                                    if(!userInformation[0].profile_image_url)
                                        set.profile_image_url = profile_image_url;

                                    updateUserTable(res, set, where, (status, updateResponse) => {

                                        userTableSelect(res, where, (status, userInformation) => {

                                            bakeResponse(loginResponse, userInformation[0], objNotification,
                                                         status, userBalanceResponse[0], (body) => {
                                                res.json(body);
                                            });
                                        });
                                    });
                                }
                            });
                        });
                    });
				   }
				   else
				   {
					   let error= {
                            "code": 502,
                            "status": false,
                            "message": "You have already signup via Manual Login with this Email!",
                        };
					   res.json({status:error});
				   }
                });
				
            }
            else {
				
				
                mainUsersave(res, email, email, phone, mainPassword, (status, sigupResponse) => {

                    userTableSave(res, name, email, phone, username, password, social_media_type,
                                  social_media_value, profile_image_url, (status, userResponse) => {

                        userTableSelect(res, where, (status, userInformation) => {

                            let insertObj = {
                                notification_id : notification_id,
                                user_id         : userInformation[0].id,
                                device_id       : device_id,
                                device_type     : device_type,
                                created_at      : common.todayByMoment(),
                                updated_at      : common.todayByMoment()
                            };
                            noticeInsert(res, insertObj, (status, pushresponse) => {

                                insertObj= { user_id: userInformation[0].id };
                                userBalanceInsert(res, insertObj, (status, balanceResponse) => {

                                    where= { 'user_id': userInformation[0].id };
                                    userBalanceSelect(res, where, (status, userBalanceResponse) => {
                                        where = {"user_id": userInformation[0].id};
                                        notificationTableSelect(res, where, (status, objNotification) => {

                                            bakeResponse(sigupResponse, userInformation[0], objNotification,
                                                         status, userBalanceResponse[0], (body) => {
                                                body.data.new_user= true;
                                                res.json(body);
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
    
       },

    signupManual: (req, res) => {
        let name                = req.body.name;
        let email               = req.body.email.toLowerCase();
        let phone               = req.body.phone || '';
        let username            = req.body.username;
        let password            = common.generateHash(req.body.password);
        let mainPassword        = email+"-gamor";
        let notification_id     = req.body.notification_id;
        let device_id           = req.body.device_id;
        let device_type         = req.body.device_type;
        let profile_image_url   = '';
        let social_media_type   = req.body.social_media_type || undefined;
        let social_media_value  = req.body.social_media_value || undefined;

        login(res, email, mainPassword, (loginStatus, loginResponse) => {
            if( loginStatus.status == true ) {
                let where = { email };
                userTableSelect(res, where, (status, userInformation) => {
                        console.log(userInformation);
                    if(userInformation.length) {
                        var platform="";
							if(userInformation[0].facebook_id)
							{
								platform="facebook";
							}
							else if(userInformation[0].google_id)
							{
								platform="google";
							}
							else
							{
								platform="";
							}
							
							if(platform=="")
							{
                            status.message = "user already exists";
							}
						    else
							{
						    status.message = "You have already used this email to create an account using " +platform + ". Please login using " +platform + " or use a different email address.";
							}
                        status.status = 502;
                        res.json(status);
                    }
                    else {
                        let set   = { password };
                        let where = { email };

                        updateUserTable(res, set, where, (status, updateResponse) => {
							
                            let where = { 'user_id' : userInformation[0].id };

                            let objNotification = {
                                notification_id : notification_id,
                                device_id       : device_id,
                                device_type     : device_type,
                                updated_at      : common.todayByMoment()
                            };
                            updateNotificationTable(res, objNotification, where,
                                                    (status, updateResponse) => {

                                notificationTableSelect(res, where, (status, objNotification) => {

                                    userBalanceSelect(res, where, (status, userBalanceResponse) => {

                                        bakeResponse(loginResponse, userInformation[0], objNotification,
                                                     loginStatus, userBalanceResponse[0], (body) => {
                                            res.json(body);
                                        });
                                    });
                                });
                            });
                        });
                    }
                });
            }
            else {
                mainUsersave(res, email, email, phone, mainPassword, (status, sigupResponse) => {

                    let where = { email };
                    userTableSelect(res, where, (status, userInformation) => {
                           
                        if(userInformation.length) {
							
							var platform="";
							if(userInformation[0].facebook_id)
							{
								platform="facebook";
							}
							else if(userInformation[0].google_id)
							{
								platform="google";
							}
							else
							{
								platform="";
							}
							
							if(platform=="")
							{
                            status.message = "user already exists";
							}
						    else
							{
						    status.message = "You have already used this email to create an account using " +platform + ". Please login using " +platform + " or use a different email address.";
							}
						
					         
                            status.status = 502;
                            res.json(status);
                        }
                        else {
                            userTableSave(res, name, email, phone, username, password, social_media_type,
                                        social_media_value, profile_image_url, (status, userResponse) => {

                                where = { email };
                                userTableSelect(res, where, (status, userInformation) => {

                                    let insertUrl= url + '/api/1/table/push_notification/insert';

                                    let insertObj = {
                                        notification_id : notification_id,
                                        user_id         : userInformation[0].id,
                                        device_id       : device_id,
                                        device_type     : device_type,
                                        created_at      : common.todayByMoment(),
                                        updated_at      : common.todayByMoment()
                                    };
                                    noticeInsert(res, insertObj, (status, pushresponse) => {

                                        insertObj= { user_id: userInformation[0].id };
                                        userBalanceInsert(res, insertObj, (status, balanceResponse) => {

                                            where = {"user_id": userInformation[0].id};
                                            userBalanceSelect(res, where, (status, userBalanceResponse) => {

                                                notificationTableSelect(res, where, (status, objNotification) => {

                                                    bakeResponse(sigupResponse, userInformation[0], objNotification,
                                                                status, userBalanceResponse[0], (body) => {
                                                        body.data.new_user= true;
                                                        res.json(body);
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        }
                    });
                });
            }
        });
    },

    logout: (req, res) => {
        let user_id   = req.body.user_id;
        let logoutUrl = urlAuth+'/user/logout';
        let headers = {
            'Content-Type': 'application/json'
        };
        headers.Authorization = req.get("Authorization");
        headers['X-Hasura-Role'] = req.get("X-Hasura-Role");
        headers['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        let logoutOpts = {
        method  : 'GET',
        headers : headers
        };

        request(logoutUrl, logoutOpts, res, (status, response) => {
            let where = { user_id };

            let objNotification = {
                notification_id : '',
                device_id       : '',
                device_type     : '',
                updated_at      : common.todayByMoment()
            };
            updateNotificationTable(res, objNotification, where, (status, updateResponse) => {
                res.json({status: status, data: response });
            });
        });
    },

    userInfo: (req, res) => {
        let user_id = req.query.user_id;

        if(!user_id) {
            status= {
                "code": 404,
                "status": false,
                "message": "User id is required"
            };
            res.json({ status });
        }
        else {
            let where = { id: user_id };

            userTableSelect(res, where, (userStatus, userInformation) => {

                if(userInformation.length == 0) {
                    let error= {
                        "code": 502,
                        "status": false,
                        "message": "User not Found"
                    };
                    res.json({status: error});
                }
                else {
                    where = { user_id };
                    notificationTableSelect(res, where, (status, objNotification) => {

                        userBalanceSelect(res, where, (status, userBalanceResponse) => {

                            bakeResponse('', userInformation[0], objNotification, userStatus,
                                         userBalanceResponse[0], (body) => {
                                res.json(body);
                            });
                        });
                    });
                }
            });
        }
    },

    updateFCM: (req, res) => {
        let user_id         = req.body.user_id;
        let notification_id = req.body.notification_id;

        if(user_id && notification_id) {
            updateNotificationTable(res, {notification_id}, {user_id}, (status, updateResponse) => {
                if(!status.status) console.log(JSON.stringify(status));
                res.json({status, data: updateResponse });
            });
        }
        else {
            let status = {
                code    : 502,
                status  : '',
                message : "Please Send token and user ID"
            };
            res.json({status, data: [] });
        }
    },

    forgotPassword: (req, res) => {
        let email= req.body.email;

        let where = { email };

        userTableSelect(res, where, (userStatus, userInformation) => {
            if(!userStatus.status) console.log(JSON.stringify(userStatus));

            if(userInformation.length) {

                let randomCrypticWord= crypto.randomBytes(4).toString('hex').replace(/0|o/gi, 'p');

                resetPasswordMail(userInformation, email, randomCrypticWord);

                updateUserToken(res, email, randomCrypticWord, (status, data) => {
                    if(!status.status) console.log(JSON.stringify(status));
                    res.json({status, data });
                });
            }
            else {
                let status = {
                    code    : 502,
                    status  : '',
                    message : "User not found"
                };
                res.json({status, data: [] });
            }
        });
    },

    resetPassword: (req, res) => {
        let table= "user";
        let user_token= htmlEscape(req.body.u);
        let password= htmlEscape(req.body.password);
        let cpassword= htmlEscape(req.body.cpassword);

        if(password === cpassword) {
            let set= {password: common.generateHash(password), user_token: ''};
            let where= {user_token};
            crud.update(res, table, set, where, headerUser, (error, data) => {
                if(!error.status) console.log(JSON.stringify(status));
                res.end("Password Reset Complete, Please Login With The Password You Just Created");
            });
        }
        else {
            req.body.isincorrect= true;
            req.body.u= user_token;
            delete req.body.password;
            delete req.body.cpassword;
            res.redirect(urlModule.format({
                pathname: 'https://panel.gamor-dev.hasura-app.io/admin/password/reset',
                query: req.body
            }));
        }
    },

    updateProfilePic: (req, res) => {
        let id= req.body.user_id || '';

        if(id && req.file.filename) {
            let where = { id };
            let set = {};
            set.profile_image_url = req.file.filename;

            updateUserTable(res, set, where, (status, updateResponse) => {
                res.json({status, data: {} });
            });
        }
        else {
            let status = {
                code    : 502,
                status  : false,
                message : "Please send user ID and profile Image"
            };
            res.json({status, data: {} });
        }
    },
}

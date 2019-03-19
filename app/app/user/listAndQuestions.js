"use strict";
// load up the user model
var fetch   = require('node-fetch');
var moment   = require('moment');
var async = require('async');

// required files
const common= require('./common');

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

let categories = (res, where, headerUser, cb) => {
    let selectUrl   = url + '/api/1/table/categories/select';
    let selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where,
        order_by: [{ column: 'air_date', order: 'desc' }]
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, categoriesList) => {
        cb(status, categoriesList)
    });
};

let favourites = (res, where, headerUser, cb) => {
    let selectUrl   = url + '/api/1/table/favourite/select';
    let selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where: where
    }),
    headers : headerUser
    };

    request(selectUrl, selectOpts, res, (status, favouriteList) => {
        cb(status, favouriteList)
    });
};

let selectQustion = (res, where, headerUser, cb) => {
    let selectUrl = url + '/api/1/table/question/select';
    let selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where
    }),
    headers : headerUser
    };
    request(selectUrl, selectOpts, res, (status, questions) => {
        cb(status, questions);
    });
};

let selectOptions = (res, where, headerUser, cb) => {
    let selectUrl = url + '/api/1/table/options/select';
    let selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where
    }),
    headers : headerUser
    };
    request(selectUrl, selectOpts, res, (status, options) => {
        cb(status, options);
    });
};

let selectUsersAnswer = (res, where, headerUser, cb) => {
    let selectUrl = url + '/api/1/table/user_answers/select';
    let selectOpts = {
    method  : 'POST',
    body    : JSON.stringify({
        columns: ['*'],
        where
    }),
    headers : headerUser
    };
    request(selectUrl, selectOpts, res, (status, answers) => {
        cb(status, answers);
    });
};

let updateUserAnswer= (res, set, where, headerUser, cb) => {
    let updateUrl = url + '/api/1/table/user_answers/update';

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
};

const insertHistory= (res, objects, headerUser, cb) => {
  let chosenOneUrl   = url+'/api/1/table/history/insert';
  let chosenOneOpts = {
      method  : 'POST',
      body    : JSON.stringify({ objects }),
      headers : headerUser
  };

  request(chosenOneUrl, chosenOneOpts, res, (status, response) => {
    cb(status, response);
  });
}

let updateHistory= (res, set, where, headerUser, cb) => {
    let updateUrl = url + '/api/1/table/history/update';

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
};

// DELETE data from user_answers table
let delete_user_answers = (res, where, cb) => {
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
            "args": {
                "table": "user_answers",
                "where": where
            }
        })
    };
    request(getUrl, getoptions, res, (status, response) => {
        cb(status, response);
    });
};

module.exports = {
    categoryList : (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let id      = +req.query.parent_id;
        let user_id = +req.query.user_id;

        let where = {
            parent_id   : id,
            is_approved : true,
            is_live     : true,
            is_active   : true
        };
        categories(res, where, headerUser, (status, categoriesList) => {

            if( status.status == false ) {
                res.json({ status: status});
            }
            else {
                let check_is_active= true;
                common.getCategoriesWithPrediction(res, headerUser, categoriesList, user_id, check_is_active, (err, categoriesListWithPredictions) => {
                    if(err) console.log(err);
                    else res.json({ status: status, data: categoriesListWithPredictions });
                });
            }
        });
    },

    favouriteStatus: (req, res) => {
        let user_id     = Number(req.body.user_id);
        let category_id = Number(req.body.category_id);
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let where ={ user_id, category_id };

        favourites(res, where, headerUser, (status, favouriteList) => {
            if(favouriteList.length == 0) {
                var insertUrl   = url+'/api/1/table/favourite/insert';
                var insertOpts = {
                    method  : 'POST',
                    body    : JSON.stringify({
                        objects: [{ user_id, category_id }]
                    }),
                    headers : headerUser
                };

                request(insertUrl, insertOpts, res, (status, response) => {
                    res.json({status, data: response });
                });
            }
            else {
                var getUrl = url+'/v1/query';
                var getoptions = {
                    method: 'POST',
                    headers: headerUser,
                    body: JSON.stringify({
                        "type": "delete",
                        "args": {
                        "table": "favourite",
                        "where": { user_id, category_id },
                        "returning": ["id"]
                        }
                    })
                };
                request(getUrl, getoptions, res, (status, response) => {
                    res.json({status: status, data: response });
                });
            }
        });
    },

    favourites: (req, res) => {
        let user_id = Number(req.query.user_id);
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let favourite, where ={ user_id };
        favourites(res, where, headerUser, (status, favouriteList) => {
            let favouriteIds = favouriteList.map( favourite => favourite.category_id );

            where = {
                "categories_id": {
                    "$in" : favouriteIds
                },
                is_approved : true,
                is_active   : true
            };
            categories(res, where, headerUser, (status, categoryList) => {

                categoryList.forEach( c => {
                    if(c.icon) c.icon = common.adminPanelImagePath()+c.icon;

                    favourite= favouriteList.find( f => f.category_id === c.categories_id );
                    c.is_favourite= (favourite) ? true: false;
                });
                res.json({status, data: categoryList});
            });
        });
    },

    trendings: (req, res) => {
        let selectUrl   = url + '/api/1/table/categories/select';
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let user_id = +req.query.user_id;

        let favourite, where, categoryIds= [];
        let selectOpts = {
        method  : 'POST',
        body    : JSON.stringify({
            columns: ['*'],
            where: {
                trending    : true,
                is_approved : true,
                is_active   : true,
                parent_id   : {"$gt" : 0}
            }
        }),
        headers : headerUser
        };

        request(selectUrl, selectOpts, res, (status, categoryList) => {

            categoryIds= categoryList.map( c => c.categories_id);

            where= {
                user_id,
                'category_id': { "$in": categoryIds }
            };
            favourites(res, where, headerUser, (status, favouriteList) => {

                categoryList.forEach( c => {
                    if(c.icon) c.icon = common.adminPanelImagePath()+c.icon;

                    favourite= favouriteList.find( f => f.category_id === c.categories_id );
                    c.is_favourite= (favourite) ? true: false;
                });
                res.json({status, data: categoryList});
            });
        });
    },

    questions : (req, res) => {
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let id      = +req.query.category_id;
        let user_id = +req.query.user_id;
        let where   = { category_id : id, is_approved : true }, userAnswer;

        selectQustion(res, where, headerUser, (status, questions) => {
             console.log(questions);
            if(status.status == false) res.json({ status });

            let questionsId = questions.map( question => question.question_id );
            
            where = { "question_id": { "$in" : questionsId } };

            selectOptions(res, where, headerUser, (status, options) => {

                where.user_id= user_id;
                selectUsersAnswer(res, where, headerUser, (status, usersAnswer) => {

                    where = {
                        categories_id : id,
                        is_approved : true,
                        is_live : true,
                        is_active : true
                    };
                    categories(res, where, headerUser, (status, categoriesList) => {

                        let list = questions.map(q => {
                            q.options  = options.filter( o => q.question_id == o.question_id );
                            q.attempts = usersAnswer.filter( u => q.question_id == u.question_id ).length;
                            userAnswer = usersAnswer.find( u => q.question_id == u.question_id );

                            if(userAnswer) q.user_answer_id = userAnswer.user_answer_id;
                            else q.user_answer_id = "";

                            return Object.assign({}, categoriesList[0], q);
                        });
                        res.json({ status: status, data: list });
                    });
                });
            });
        });
    },

    chosenOne: (req, res) => {
        let question_id     = +req.body.question_id;
        let user_answer_id  = +req.body.options_id;
        let user_id         = +req.body.user_id;
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        if( !(question_id && user_answer_id) ) {
            let status = {
                code    : 502,
                status  : false,
                message : "Parameters are Required"
            };
            res.json({status, data: '' });
        }
        else {
            let where= { question_id, user_id };
            selectUsersAnswer(res, where, headerUser, (status, UserAnswerInfo) => {

                if(UserAnswerInfo.length) {
                    let oneDayBeforeToday= moment().format("YYYY-MM-DD[T]HH:mm:ss.SSSSSSZ");

                    where= {question_id};
                    selectQustion(res, where, headerUser, (status, questions) => {

                        where = { categories_id : questions[0].category_id, air_date: { "$gt": oneDayBeforeToday } };
                        categories(res, where, headerUser, (status, categoriesList) => {

                            if(categoriesList.length) {
                                let set= { user_answer_id };
                                where= { question_id, user_id };
                                updateUserAnswer(res, set, where, headerUser, (status, answerResponse) => {

                                    set= { timestamp: common.todayByMoment() };
                                    updateHistory(res, set, where, headerUser, (status, response) => {
                                        res.json({status: status, data: response });
                                    });
                                });
                            }
                            else {
                                status.code= 502;
                                status.status= false;
                                status.message= "Time is up to Answer This Question";
                                res.json({status});
                            }
                        });
                    });
                }
                else {
                    let objects;
                    let chosenOneUrl   = url+'/api/1/table/user_answers/insert';
                    let chosenOneOpts = {
                        method  : 'POST',
                        body    : JSON.stringify({
                        objects: [ { question_id, user_answer_id, user_id } ]
                        }),
                        headers : headerUser
                    };

                    request(chosenOneUrl, chosenOneOpts, res, (status, response) => {

                        where= { question_id };
                        selectQustion(res, where, headerUser, (status, questionInfo) => {

                            objects= [{ user_id, question_id, category_id: questionInfo[0].category_id }];
                            insertHistory(res, objects, headerUser, (status, response) => {
                                res.json({status: status, data: response });
                            });
                        });
                    });
                }
            });
        }
    },

    deleteAnswer: (req, res) => {
        let question_id     = +req.body.question_id;
        let user_id         = +req.body.user_id;
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        if( !( question_id && user_id ) ) {
            let status = {
                code    : 502,
                status  : false,
                message : "Parameters are Required"
            };
            res.json({status, data: '' });
        }
        else {
            let where= { question_id, user_id };
            delete_user_answers(res, where, (status, response) => {

                let set= {timestamp: common.todayByMoment()};
                updateHistory(res, set, where, headerUser, (status, response) => {
                    res.json({status: status, data: response });
                });
            });
        }
    }
};

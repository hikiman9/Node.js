const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({ secret: 'secretCode', resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
require('dotenv').config();

var db;

MongoClient.connect(process.env.DB_URL, function (error, client) {
    if (error) return console.log(error)

    db = client.db('todoapp');

    app.listen(process.env.PORT, function () {
        console.log('listening on 8080');
    });
})



app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/pet', function (req, res) {
    res.send('welcome to the pet shop');
});

app.get('/beauty', function (req, res) {
    res.send('welcome to the beauty shop');
});

app.get('/write', function (req, res) {
    res.sendFile(__dirname + '/write.html');
});

app.post('/add', function (req, res) {
    res.send('전송완료');
    db.collection('counter').findOne({ name: 'postCount' }, function (error, result) {
        db.collection('post').insertOne({ _id: result.totalPost + 1, title: req.body.title, detail: req.body.detail }, function (error, result) {
            console.log('plan updated');
            db.collection('counter').updateOne({ name: 'postCount' }, { $inc: { totalPost: 1 } }, function (error, result) {
                if (error) { return console.log(error) };
            });
        })
    });
});

app.get('/list', function (req, res) {
    //DB의 post라는 콜렉션의 모든 데이터를 꺼내주세요
    db.collection('post').find().toArray(function (error, result) {
        res.render('list.ejs', { posts: result });
    });
});

app.get('/search', function (req, res) {
    var condition = [
        {
            $search: {
                index: 'titleSearch',
                text: {
                    query: req.query.value,
                    path: ['title', 'detail']  // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
                }
            }
        }
        //이쯤에 검색 조건 코드 들어감
    ]
    db.collection('post').aggregate(condition).toArray(function (error, result) {
        res.render('search.ejs', { posts: result });
    })
})

app.post('/delete', function (req, res) {
    req.body._id = parseInt(req.body._id);
    db.collection('post').deleteOne(req.body, function () {
        console.log('delete accomplished');
        res.status(200).send({ message: 'from server - success' });
    })
})

app.get('/detail/:id', function (req, res) {
    db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (error, result) {
        res.render('detailPage.ejs', { data: result });
    })
})

app.post('/delete', function (req, res) {
    console.log(req.body._id);
})

app.get('/edit/:id', function (req, res) {
    db.collection('post').findOne({ _id: parseInt(req.params.id) }, function (error, result) {
        res.render('edit.ejs', { data: result })
    })
})

app.put('/edit', function (req, res) {
    //폼에 담긴 데이터를 가지고 
    //db.collection에다가 업데이트 함
    db.collection('post').updateOne({ _id: parseInt(req.body.id) }, { $set: { title: req.body.title, detail: req.body.detail } }, function (error, result) {
        console.log('edit accomplished');
        res.redirect('/list');
    })
})

app.get('/login', function (req, res) {
    res.render('login.ejs');
})

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/fail'
}), function (req, res) {
    res.redirect('/')
})

app.get('/myPage', loginCheck, function (req, res) {
    console.log(req.user);
    res.render('myPage.ejs')
})

function loginCheck(req, res, next) {
    if (req.user) { //로그인 후 세션이 있으면 req.user가 항상 있음
        next();
    } else {
        res.send('로그인 하고 오셈');
    }
}

passport.use(new LocalStrategy({
    usernameField: 'id', //유저가 입력한 아이디 비번 항목이 뭔지 정의 -> input 태그의 name이 'id'인 걸로 ~
    passwordField: 'pw',
    session: true, //로그인 후 세션을 저장할 것인지
    passReqToCallback: false, //아이디 비번 말고 다른 정보 검증을 할 지 -> true 로 하면 아래 콜백함수에 인자 하나 늘어남
}, function (insertedId, insertedPw, done) {
    //console.log(입력한아이디, 입력한비번);
    db.collection('login').findOne({ id: insertedId }, function (error, result) {
        if (error) return done(error)

        if (!result) return done(null, false, { message: '존재하지않는 아이디요' })
        if (insertedPw == result.pw) {
            return done(null, result)
        } else {
            return done(null, false, { message: '비번틀렸어요' })
        }
    })
}));

//로그인 성공 시 동작,id를 이용해서 세션 저장시키는 코드
//저 위에 로그인 성공시 done()에 들어간 result가 여기 user로 들어감
passport.serializeUser(function (user, done) {
    done(null, user.id)
    console.log(user.id);
});

//해당 세션 데이터를 가진 사람을 DB에서 찾는 코드
passport.deserializeUser(function (id, done) { //로그인한 유저의 세션 아이디를 바탕으로 개인정보를 DB에서 찾는 역할
    //DB에서 바로 위에 있는 user.id로 유저를 찾은 뒤에 유저정보를
    db.collection('login').findOne({ id: id }, function (error, result) {
        console.log(result);
        done(null, result);
    })
    // done(null, {})//여기 중괄호에 넣어줌
}); 
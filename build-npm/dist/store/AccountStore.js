"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _mutations = require("../mutations");

var types = _interopRequireWildcard(_mutations);

var _idbInstance = require("../services/api/wallet/idb-instance");

var _idbInstance2 = _interopRequireDefault(_idbInstance);

var _immutable = require("immutable");

var _immutable2 = _interopRequireDefault(_immutable);

var _bcxjsCores = require("bcxjs-cores");

var _PrivateKeyStore = require("../modules/PrivateKeyStore");

var _PrivateKeyStore2 = _interopRequireDefault(_PrivateKeyStore);

var _bcxjsWs = require("bcxjs-ws");

var _localStorage = require("../lib/common/localStorage");

var _localStorage2 = _interopRequireDefault(_localStorage);

var _api = require("../services/api");

var _api2 = _interopRequireDefault(_api);

var _url = require("url");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var STORAGE_KEY = "__gph__";

var accountStorage = new _localStorage2.default(STORAGE_KEY);

var _chainstore_account_ids_by_key = void 0;
var _no_account_refs = void 0;

var initialState = {
    update: false,
    subbed: false,
    currentAccount: null,
    linkedAccounts: _immutable2.default.Set(),
    myIgnoredAccounts: _immutable2.default.Set(),
    unFollowedAccounts: _immutable2.default.Set(process.browser || true ? accountStorage.get("unfollowed_accounts", []) : []),
    searchAccounts: _immutable2.default.Map(),
    searchTerm: "",
    initial_account_refs_load: true,
    account_refs: null
};

var getters = {
    linkedAccounts: function linkedAccounts(state) {
        return state.linkedAccounts;
    }
};

var actions = {
    loadDbData: function loadDbData(_ref) {
        var dispatch = _ref.dispatch,
            state = _ref.state;

        var linkedAccounts = _immutable2.default.Set().asMutable();
        var chainId = _bcxjsWs.Apis.instance().chain_id;
        return new _promise2.default(function (resolve, reject) {
            _idbInstance2.default.load_data("linked_accounts").then(function (data) {
                if (!data.length) {
                    //config current account
                    accountStorage.set("currentAccount", null);
                }
                var accountPromises = data.filter(function (a) {
                    if (a.chainId) {
                        return a.chainId === chainId;
                    } else {
                        return true;
                    }
                }).map(function (a) {
                    linkedAccounts.add(a.name);
                    dispatch("_addIgnoredAccount", a.name);
                    return (0, _bcxjsCores.FetchChain)("getAccount", a.name);
                });
                _promise2.default.all(accountPromises).then(function (results) {
                    state.linkedAccounts = linkedAccounts.asImmutable();
                    dispatch("tryToSetCurrentAccount", null).then(function (acc_res) {
                        _bcxjsCores.ChainStore.subscribe(function () {
                            dispatch("chainStoreUpdate");
                        });
                        resolve(true);
                        state.subbed = true;
                    });
                }).catch(function (err) {
                    _bcxjsCores.ChainStore.subscribe(function () {
                        dispatch("chainStoreUpdate");
                    });
                    state.subbed = true;
                    reject(err);
                });
            }).catch(function (err) {
                // alert(err);
                reject(err);
            });
        });
    },
    _addIgnoredAccount: function _addIgnoredAccount(_ref2, name) {
        var state = _ref2.state;

        if (state.unFollowedAccounts.includes(name) && !state.myIgnoredAccounts.has(name)) {
            state.myIgnoredAccounts = state.myIgnoredAccounts.add(name);
        }
    },

    chainStoreUpdate: function chainStoreUpdate(_ref3) {
        var dispatch = _ref3.dispatch,
            state = _ref3.state;

        if (state.update) {
            state.update = false;
        }
        dispatch("addAccountRefs");
    },
    addAccountRefs: function addAccountRefs(_ref4) {
        var rootGetters = _ref4.rootGetters,
            state = _ref4.state,
            dispatch = _ref4.dispatch;

        //  Simply add them to the linkedAccounts list (no need to persist them)
        var account_refs = rootGetters["AccountRefsStore/account_refs"];
        if (!state.initial_account_refs_load && state.account_refs === account_refs) return;
        state.account_refs = account_refs;
        var pending = false;
        state.linkedAccounts = state.linkedAccounts.withMutations(function (linkedAccounts) {
            account_refs.forEach(function (id) {
                var account = _bcxjsCores.ChainStore.getAccount(id);
                if (account === undefined) {
                    pending = true;
                    return;
                }
                if (account && !state.unFollowedAccounts.includes(account.get("name"))) {
                    linkedAccounts.add(account.get("name"));
                } else {
                    dispatch("_addIgnoredAccount", account.get("name"));
                }
            });
        });
        state.initial_account_refs_load = pending;
        return dispatch("tryToSetCurrentAccount");
    },
    tryToSetCurrentAccount: function tryToSetCurrentAccount(_ref5) {
        var dispatch = _ref5.dispatch,
            state = _ref5.state;

        if (accountStorage.get("currentAccount", null)) {
            return dispatch("setCurrentAccount", accountStorage.get("currentAccount", null));
        }
        if (state.linkedAccounts.size) {
            return dispatch("setCurrentAccount", state.linkedAccounts.first());
        }
        return true;
    },
    setCurrentAccount: function setCurrentAccount(_ref6, name) {
        var dispatch = _ref6.dispatch,
            state = _ref6.state;
        var isCreateAccount;
        return _regenerator2.default.async(function setCurrentAccount$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        isCreateAccount = false;

                        if (name && (typeof name === "undefined" ? "undefined" : (0, _typeof3.default)(name)) == "object") {
                            isCreateAccount = !!name.isCreateAccount;
                            name = name.account;
                        }
                        if (!name) {
                            state.currentAccount = null;
                            state.linkedAccounts = _immutable2.default.Set();
                        } else {
                            state.currentAccount = name;
                            state.linkedAccounts = state.linkedAccounts.add(name);
                        }
                        accountStorage.set("currentAccount", state.currentAccount);

                        if (!name) {
                            _context.next = 8;
                            break;
                        }

                        return _context.abrupt("return", new _promise2.default(function (resolve) {
                            setTimeout(function () {
                                dispatch("user/fetchUserForIsSave", { nameOrId: name, isSave: true }, { root: true }).then(function (acc_res) {
                                    delete acc_res.success;
                                    // console.info("acc_res",acc_res);
                                    resolve(acc_res);
                                });
                            }, isCreateAccount ? 2000 : 100);
                        }));

                    case 8:
                        return _context.abrupt("return", { code: 0, message: "Name can not be empty" });

                    case 9:
                    case "end":
                        return _context.stop();
                }
            }
        }, null, undefined);
    },
    onCreateAccount: function onCreateAccount(_ref7, _ref8) {
        var state = _ref7.state,
            dispatch = _ref7.dispatch;
        var name_or_account = _ref8.name_or_account,
            owner_pubkey = _ref8.owner_pubkey;

        var account = name_or_account;
        if (typeof account === "string") {
            account = {
                name: account
            };
        }

        if (account["toJS"]) account = account.toJS();

        if (account.name == "" || state.linkedAccounts.get(account.name)) return _promise2.default.resolve();

        if (!_bcxjsCores.ChainValidation.is_account_name(account.name)) throw new Error("Invalid account name: " + account.name);
        return _idbInstance2.default.add_to_store("linked_accounts", {
            name: account.name,
            chainId: _bcxjsWs.Apis.instance().chain_id
        }).then(function () {
            //console.log("[AccountStore.js] ----- Added account to store: ----->", account.name);
            // return dispatch("AccountRefsStore/loadDbData",null,{root:true}).then(()=>{
            //     return dispatch("loadDbData").then(()=>{

            //     })  
            // })  
            state.linkedAccounts = state.linkedAccounts.add(account.name);

            if (state.linkedAccounts.size === 1) {
                return dispatch("setCurrentAccount", { account: account.name, isCreateAccount: true }).then(function (acc_res) {
                    if (owner_pubkey) {
                        return _api2.default.Account.getAccountIdByOwnerPubkey(owner_pubkey).then(function (userId) {
                            var id = userId && userId[0];
                            if (id) {
                                id = userId[0];
                                return id;
                            }
                            dispatch("account/account_signup_complete", { userId: id }, { root: true });
                        });
                    }
                });
            } else {
                return { code: 1 };
            }
        });
    }
};

var mutations = {};

exports.default = {
    state: initialState,
    actions: actions,
    mutations: mutations,
    getters: getters,
    namespaced: true
};
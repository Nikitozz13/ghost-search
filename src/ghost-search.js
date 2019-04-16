'use strict';

/**
 * @requires ../node_modules/fuse.js/dist/fuse.js
 * @requires ../node_modules/@babel/polyfill/dist/polyfill.min.js
 */

class GhostSearch {
    constructor(args) {

        this.check = false;

        const defaults = {
            host: '',
            key: '',
            version: 'v2',
            input: '#ghost-search-field',
            results: '#ghost-search-results',
            button: '',
            defaultValue: '',
            template: function(result) {
                let url = [location.protocol, '//', location.host].join('');
                return '<a href="' + url + '/' + result.slug + '/">' + result.title + '</a>';
            },
            trigger: 'focus',
            options: {
                keys: ['title'],
                limit: 10,
                async: true,
                asyncChunks: 1,
                shouldSort: true,
                tokenize: true,
                matchAllTokens: true,
                includeMatches: true,
                includeScore: true,
                threshold: 0.3,
                location: 0,
                distance: 50000,
                maxPatternLength: 32,
                minMatchCharLength: 2
            },
            api: {
                resource: 'posts',
                parameters: {
                    limit: 'all',
                    fields: ['title', 'slug'],
                    filter: '',
                    include: '',
                    order: '',
                    formats: '',
                    page: ''
                },
            },
            on: {
                beforeDisplay: function(){},
                afterDisplay: function(results){},
                beforeFetch: function(){},
                afterFetch: function(results){},
                beforeSearch: function(){}
            }
        }

        const merged = this.mergeDeep(defaults, args);
        Object.assign(this, merged);
        this.init();

    }

    mergeDeep(target, source) {
        if ((target && typeof target === 'object' && !Array.isArray(target) && target !== null) && (source && typeof source === 'object' && !Array.isArray(source) && source !== null)) {
            Object.keys(source).forEach(key => {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            });
        }
        return target;
    }

    fetch(){

        this.on.beforeFetch();

        let ghostAPI = new GhostContentAPI({
            host: this.host,
            key: this.key,
            version: this.version
        });

        let browse = {}
        let parameters = this.api.parameters;

        for (var key in parameters) {
            if(parameters[key] != ''){
                browse[key] = parameters[key]
            }
        }

        ghostAPI[this.api.resource]
            .browse(browse)
            .then((data) => {
                this.search(data);
            })
            .catch((err) => {
                console.error(err);
            });
    }

    createElementFromHTML(htmlString) {
        var div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    }

    displayResults(data) {

        this.on.beforeSearch();

        let inputValue = document.querySelectorAll(this.input)[0].value.trim();
        if (this.defaultValue != '') {
            inputValue = this.defaultValue;
        }
        if (this.options.async) {
            this.searchAsyncImproved(data, inputValue)
              .catch(e => { console.error(e) });
        } else {
            const fuse = new Fuse(data, this.options);
            const results = fuse.search(inputValue);
            this.displayResultsInBrowser(results);
        }

    }

    async searchAsync(fuse, inputValue) {

        let promise = new Promise(function(resolve, reject) {
            resolve(fuse.search(inputValue));
        });
        let results = await promise;
        return results;

    }

    async searchAsyncImproved(data, inputValue) {

        const chunksCount = this.options.asyncChunks;
        const promises = [];

        for (let i=0; i < data.length; i+=chunksCount) {
            const fuse = new Fuse(data.slice(i, i + chunksCount), this.options);
            const promiseInstance = new Promise(function(resolve, reject) {
                setTimeout(() => resolve(fuse.search(inputValue)), 0);
            });
            promises.push(promiseInstance);
        }
        let results = await Promise.all(promises);
        results = results.flat().sort((a, b) => { return a.score - b.score });
        this.displayResultsInBrowser(results);

    }

    displayResultsInBrowser(results) {

        results = results.slice(0, this.options.limit);

        let tempBlock = document.createElement('div');

        for (let key in results) {
            if (key < results.length) {
                let item = results[key];
                /* For case if includeMatches turned on */
                if (item.matches) item = item.item;
                //document.querySelectorAll(this.results)[0].appendChild(this.createElementFromHTML(this.template(item)));
                tempBlock.appendChild(this.createElementFromHTML(this.template(item)));
            }
        }

        document.querySelectorAll(this.results)[0].innerHTML = tempBlock.innerHTML;

        this.on.afterDisplay(results);
        this.defaultValue = '';

    }

    search(data){

        this.on.afterFetch(data);
        this.check = true;

        if(this.defaultValue != ''){
            this.on.beforeDisplay()
            this.displayResults(data)
        }

        if (this.button != '') {
            let button = document.querySelectorAll(this.button)[0];
            if (button.tagName == 'INPUT' && button.type == 'submit') {
                button.closest('form').addEventListener("submit", e => {
                    e.preventDefault()
                });
            };
            button.addEventListener('click', e => {
                e.preventDefault()
                this.on.beforeDisplay()
                this.displayResults(data)
            })
        }else{
            document.querySelectorAll(this.input)[0].addEventListener('keyup', e => {
                this.on.beforeDisplay()
                this.displayResults(data)
            })
        };

    }

    checkArgs(){
        if(!document.querySelectorAll(this.input).length){
            console.log('Input not found.');
            return false;
        }
        if(!document.querySelectorAll(this.results).length){
            console.log('Results not found.');
            return false;
        };
        if(this.button != ''){
            if (!document.querySelectorAll(this.button).length) {
                console.log('Button not found.');
                return false;
            };
        }
        if(this.host == ''){
            console.log('Content API Client Library host missing. Please set the host. Must not end in a trailing slash.');
            return false;
        };
        if(this.key == ''){
            console.log('Content API Client Library key missing. Please set the key. Hex string copied from the "Integrations" screen in Ghost Admin.');
            return false;
        };
        return true;
    }

    validate(){

        if (!this.checkArgs()) {
            return false;
        };

        return true;

    }

    init(){

        if (!this.validate()) {
            return;
        }

        if(this.defaultValue != ''){
            document.querySelectorAll(this.input)[0].value = this.defaultValue;
            window.onload = () => {
                if (!this.check) {
                    this.fetch()
                };
            }
        }

        if (this.trigger == 'focus') {
            document.querySelectorAll(this.input)[0].addEventListener('focus', e => {
                if (!this.check) {
                    this.fetch()
                };
            })
        }else if(this.trigger == 'load'){
            window.onload = () => {
                if (!this.check) {
                    this.fetch()
                };
            }
        }

    }

}

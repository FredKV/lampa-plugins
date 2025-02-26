(function(){
    var source = 'https://uaflix.net'; // Основний сайт

    var plugin = {
        id: 'uaflix',
        title: 'UAFLIX',
        icon: 'https://uaflix.net/favicon.ico',
        search: true,
        movie: true,
        series: true,
        
        onSearch: function (query, page, callback) {
            var url = source + '/search/' + encodeURIComponent(query); // URL для пошуку
            fetch(url)
                .then(res => res.text())
                .then(html => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var items = [];

                    doc.querySelectorAll('.movie-item').forEach(el => {
                        var title = el.querySelector('.title').textContent.trim();
                        var link = el.querySelector('a').href;
                        var poster = el.querySelector('img').src;
                        items.push({ title: title, link: link, poster: poster });
                    });

                    callback(items);
                })
                .catch(err => console.error('UAFLIX search error:', err));
        },

        onMovie: function (url, callback) {
            fetch(url)
                .then(res => res.text())
                .then(html => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var videoUrl = doc.querySelector('video source')?.src;
                    callback([{ url: videoUrl, quality: 'HD' }]);
                })
                .catch(err => console.error('UAFLIX movie error:', err));
        },

        onSeries: function (url, callback) {
            fetch(url)
                .then(res => res.text())
                .then(html => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var episodes = [];

                    doc.querySelectorAll('.series-list a').forEach((el, index) => {
                        var episodeTitle = el.textContent.trim();
                        var episodeUrl = el.href;
                        episodes.push({ episode: index + 1, title: episodeTitle, url: episodeUrl });
                    });

                    callback(episodes);
                })
                .catch(err => console.error('UAFLIX series error:', err));
        }
    };

    window.Lampa.Plugins.add(plugin);
})();
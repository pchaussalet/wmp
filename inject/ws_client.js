function loadClient(offset, revealMode) {
    var client = new nes.Client('ws://' + location.host);
    client.connect(function() {
        console.log('Connected to WMP server');
        if (revealMode) {
            setTimeout(function() {
                loadRevealNavigation(client, offset);
            }, 500);
        }else {
            loadHashNavigation(client, offset);
        }
    });
}

function loadRevealNavigation(client, offset) {
    console.log('Loading reveal.js navigation mode');
    offset = offset || [0,0,0];
    var BOTTOM = 'bottom',
        RIGHT = 'right',
        FRAGMENT = 'fragment';

    client.subscribe('/initialize', function (err, message) {
        if (message) {
            displayMainSlide(message.slide.h, message.slide.v, message.slide.f);
        }
        client.subscribe('/status', function () {
            client.request({
                method: 'POST',
                path: '/status',
                payload: {slide: Reveal.getIndices()}
            });
        });
        client.unsubscribe('/initialize');
    });

    client.subscribe('/next', function() {
        Reveal.next();
    });
    client.subscribe('/previous', function() {
        Reveal.prev();
    });

    client.subscribe('/goto', function (err, message) {
        if (message && message.slide) {
            var slide = JSON.parse(message.slide);
            displayMainSlide(slide.h, slide.v, slide.f);
        }
    });

    var handleViewChangeEvent = function () {
        client.request('/goto/' + encodeURIComponent(JSON.stringify(Reveal.getIndices())));
    };

    if (offset[0] == 0 && offset[1] == 0 && offset[2] == 0) {
        Reveal.addEventListener("slidechanged", handleViewChangeEvent, false);
        Reveal.addEventListener("fragmentshown", handleViewChangeEvent, false);
        Reveal.addEventListener("fragmenthidden", handleViewChangeEvent, false);
    }

    function displayMainSlide(h, v, f) {
        console.log(arguments);
        h = typeof h != 'undefined' ? h + offset[0] : h;
        v = typeof v != 'undefined' ? v + offset[1] : v;
        f = typeof f != 'undefined' ? f + offset[2] : f;
        Reveal.slide(h, v, f);
        Reveal.togglePause(needToPause(h, v, f));
    }

    function isMainScreen() {
        return offset[0] == 0 && offset[1] == 0 && offset[2] == 0;
    }

    function getNextDisplayPosition() {
        return [RIGHT, BOTTOM, FRAGMENT][offset.indexOf(1)];
    }

    function needToPause(h, v, f) {
        if (isMainScreen() || getNextDisplayPosition() == RIGHT) {
            return false;
        }
        var indices = Reveal.getIndices();
        if (getNextDisplayPosition() == BOTTOM) {
            return indices.v != v;
        }
        if (getNextDisplayPosition() == FRAGMENT) {
            return typeof f == 'undefined' || indices.f != f;
        }
    }
}

function loadHashNavigation(client, offset) {
    console.log('Loading standard navigation mode');
    offset = offset || 0;
    var parts;
    client.request('/parts', function (err, data) {
        if (data) {
            parts = data;
            location.hash = '#' + parts[0];
        }
    });

    client.subscribe('/initialize', function (err, message) {
        if (message) {
            var slide = message.slide;
            if (offset) {
                if (parts) {
                    slide = parts[parts.indexOf(slide) + offset];
                } else {
                    slide = +slide + offset;
                }
            }
            location.hash = '#' + slide;
        }
        client.subscribe('/status', function () {
            client.request({
                method: 'POST',
                path: '/status',
                payload: {slide: location.hash.replace('#', '')}
            });
        });
        client.unsubscribe('/initialize');
    });

    client.subscribe('/next', function () {
        var newHash,
            oldHash = location.hash.replace('#', '');
        if (parts) {
            newHash = '#' + parts[Math.min(parts.indexOf(oldHash) + 1, parts.length - 1)];
        } else {
            newHash = '#' + ++oldHash;
        }
        location.hash = newHash;
    });

    client.subscribe('/previous', function () {
        var newHash,
            oldHash = location.hash.replace('#', '');
        if (parts) {
            newHash = '#' + parts[Math.max(parts.indexOf(oldHash) - 1, 0)];
        } else {
            newHash = '#' + Math.max(--oldHash, 0);
        }
        location.hash = newHash;
    });

    client.subscribe('/goto', function (err, message) {
        console.log(message);
        var slide = message.slide;
        if (offset) {
            if (parts) {
                slide = parts[parts.indexOf(slide) + offset];
            } else {
                slide = +slide + offset;
            }
        }
        location.hash = '#' + slide;
    });

    if (offset == 0) {
        window.addEventListener("hashchange", function () {
            client.request('/goto/' + encodeURIComponent(location.hash.replace('#', '')));
        }, false);
    }
}

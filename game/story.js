// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = 'e1dcd1bee7';
squiffy.story.sections = {
	'_default': {
		'text': "<p>The year is 2009. You hear about bitcoin. Do you want to want to <a class=\"squiffy-link link-section\" data-section=\"learn more\" role=\"link\" tabindex=\"0\">learn more</a> or <a class=\"squiffy-link link-section\" data-section=\"ignore it\" role=\"link\" tabindex=\"0\">ignore it</a> ?</p>",
		'passages': {
		},
	},
	'learn more': {
		'text': "<p>You find out that bitcoins are a new form of money on the internet. Do you want to <a class=\"squiffy-link link-section\" data-section=\"mine coins\" role=\"link\" tabindex=\"0\">mine coins</a> or <a class=\"squiffy-link link-section\" data-section=\"buy coins\" role=\"link\" tabindex=\"0\">buy coins</a> or <a class=\"squiffy-link link-section\" data-section=\"get free coins\" role=\"link\" tabindex=\"0\">get free coins</a> ?</p>",
		'passages': {
		},
	},
	'ignore it': {
		'text': "<p>You forget about bitcoin until the 2011 bubble where you hear the price has gone up to $30! Do you <a class=\"squiffy-link link-section\" data-section=\"read up on bitcoin\" role=\"link\" tabindex=\"0\">read up on bitcoin</a> or <a class=\"squiffy-link link-section\" data-section=\"continue to ignore it\" role=\"link\" tabindex=\"0\">continue to ignore it</a> ?</p>",
		'passages': {
		},
	},
	'read up on bitcoin': {
		'text': "<p>You learn that bitcoin has a limited supply and is popular with libertarians. You go to Porcfest in New Hampshire and buy bitcoins and spend them on baklava. In 2017 you convert all your money to Bitcoin Cash and get bitter as it continually loses value against bitcoin.</p>",
		'passages': {
		},
	},
	'continue to ignore it': {
		'text': "<p>You wonder why everything keeps getting more expensive and attempts to save up money aren&#39;t working. You wonder if there is a common denominator to all the price increases. Years later you <a class=\"squiffy-link link-section\" data-section=\"hear bitcoin hits 69k\" role=\"link\" tabindex=\"0\">hear bitcoin hits 69k</a> .</p>",
		'passages': {
		},
	},
	'mine coins': {
		'text': "<p>You download a program called bitcoin and click on &quot;Generate coins&quot;.\nNothing seems to be happening. When do you check on your mining again:\n<a class=\"squiffy-link link-section\" data-section=\"in a week\" role=\"link\" tabindex=\"0\">in a week</a> or  <a class=\"squiffy-link link-section\" data-section=\"in a year\" role=\"link\" tabindex=\"0\">in a year</a> ?</p>",
		'passages': {
		},
	},
	'in a week': {
		'text': "<p>No block has been found. You stop mining because it is pointless.</p>",
		'passages': {
		},
	},
	'in a year': {
		'text': "<p>You have found multiple blocks. Each block is 50 bitcoins. You check the current prices and find out that your bitcoin stash is worth about $300. You find a website that sells video games and accepts bitcoin. Do you <a class=\"squiffy-link link-section\" data-section=\"buy a video game console\" role=\"link\" tabindex=\"0\">buy a video game console</a> or <a class=\"squiffy-link link-section\" data-section=\"keep the coins\" role=\"link\" tabindex=\"0\">keep the coins</a> ?</p>",
		'passages': {
		},
	},
	'buy a video game console': {
		'text': "<p>You play a video game where you pretend to be a space captain who is fighting aliens. You forget about bitcoin for years. You later play a video game where you are rewarded with satoshis. Soon you accumulate thousands of satoshis.</p>",
		'passages': {
		},
	},
	'keep the coins': {
		'text': "<p>It is now fall 2013 and bitcoin rose to hundreds of dollars. You hear about ASICs, magic boxes that make more bitcoins. Do you want to <a class=\"squiffy-link link-section\" data-section=\"keep on HODLing\" role=\"link\" tabindex=\"0\">keep on HODLing</a> or <a class=\"squiffy-link link-section\" data-section=\"buy an ASIC\" role=\"link\" tabindex=\"0\">buy an ASIC</a> ?</p>",
		'passages': {
		},
	},
	'keep on HODLing': {
		'text': "<p>You hear about a new coin that is supposed to be the next bitcoin. Do you swap your bitcoin for the <a class=\"squiffy-link link-section\" data-section=\"new coin\" role=\"link\" tabindex=\"0\">new coin</a> or <a class=\"squiffy-link link-section\" data-section=\"stay with bitcoin\" role=\"link\" tabindex=\"0\">stay with bitcoin</a> ? </p>",
		'passages': {
		},
	},
	'new coin': {
		'text': "<p>You are all excited about the new coin but over time it loses value in bitcoin terms. You spam telegram groups and reddit forums with promotion of your coin, hoping that will help. Eventually the altcoin dies, not with a bang but with a whimper.</p>",
		'passages': {
		},
	},
	'stay with bitcoin': {
		'text': "<p>You have the bitcoin still, but aren&#39;t sure if they are safe enough.\nDo you want to <a class=\"squiffy-link link-section\" data-section=\"buy a hardware wallet\" role=\"link\" tabindex=\"0\">buy a hardware wallet</a> or <a class=\"squiffy-link link-section\" data-section=\"keep your existing setup\" role=\"link\" tabindex=\"0\">keep your existing setup</a> ?</p>",
		'passages': {
		},
	},
	'buy a hardware wallet': {
		'text': "<p>Do you buy a ledger <a class=\"squiffy-link link-section\" data-section=\"direct from the manufacturer\" role=\"link\" tabindex=\"0\">direct from the manufacturer</a> or <a class=\"squiffy-link link-section\" data-section=\"from ebay\" role=\"link\" tabindex=\"0\">from ebay</a> ?</p>",
		'passages': {
		},
	},
	'direct from the manufacturer': {
		'text': "<p>You buy a ledger and the list of names, addresses, and phone numbers of customers who bought ledgers is leaked. Criminals break into your house and steal your bitcoin.</p>",
		'passages': {
		},
	},
	'from ebay': {
		'text': "<p>The ledger you bought comes with the seed words already filled out by the seller. Convenient. Unfortunately, the seller already knows the seed words and when you load your bitcoins on they are instantly stolen.</p>",
		'passages': {
		},
	},
	'keep your existing setup': {
		'text': "<p>Your hard drive dies and you can no longer access your bitcoins. You go on reddit for help and they mock you for not having previously made a backup.</p>",
		'passages': {
		},
	},
	'buy an ASIC': {
		'text': "<p>There&#39;s Bitmain, whose website looks sketchy and is based in China. There is also Butterfly Labs, whose website is polished and is based in the US. Do you buy an ASIC from <a class=\"squiffy-link link-section\" data-section=\"Bitmain\" role=\"link\" tabindex=\"0\">Bitmain</a> or from <a class=\"squiffy-link link-section\" data-section=\"Butterfly Labs\" role=\"link\" tabindex=\"0\">Butterfly Labs</a> ?</p>",
		'passages': {
		},
	},
	'Bitmain': {
		'text': "<p>You buy an Antminer S1 from Bitmain. You pay in bitcoin and a week later it shows up in a cardboard box. There is no case, just bare circuit boards. You realize it doesn&#39;t come with a power supply, so you buy a computer power supply and use the paperclip trick to make it work. When you plug it in, it sounds like a hairdryer 24/7. Your significant other moves out, even though you explained the constant droning is the sound of money being made. After a few months, the difficulty has risen so fast that the ASIC is a museum piece. You have produced less bitcoin than you spent and your electricity bill is sky high. Maybe mining isn&#39;t for you.</p>",
		'passages': {
		},
	},
	'Butterfly Labs': {
		'text': "<p>You place an order for their ASIC, but delivery is always 2 weeks away. Eventually they go bankrupt. You don&#39;t get your ASIC and your bitcoin is gone. Bitcoin is a strange game - the only winning move is not to play</p>",
		'passages': {
		},
	},
	'buy coins': {
		'text': "<p>You try to find a place to buy coins but can&#39;t. There&#39;s no stock ticker. Your bank and brokerage haven&#39;t heard of it. You forget about it until 2011 when you hear about MtGox. Do you <a class=\"squiffy-link link-section\" data-section=\"wire to gox\" role=\"link\" tabindex=\"0\">wire to gox</a> or <a class=\"squiffy-link link-section\" data-section=\"do nothing\" role=\"link\" tabindex=\"0\">do nothing</a>.</p>",
		'passages': {
		},
	},
	'do nothing': {
		'text': "<p>It&#39;s January 2018, you hear bicoin is over $10,000, the nytimes wrote an article called &quot;Everyone is getting hilariously rich and you&#39;re not&quot;\nYou remember that you could have been buying bitcoins under $10 and you question your life choices.\nDo you <a class=\"squiffy-link link-section\" data-section=\"go all in\" role=\"link\" tabindex=\"0\">go all in</a> or <a class=\"squiffy-link link-section\" data-section=\"buy a little bit\" role=\"link\" tabindex=\"0\">buy a little bit</a> ?</p>",
		'passages': {
		},
	},
	'go all in': {
		'text': "<p>You buy bitcoin from Coinbase at $15000. So much easier now that you can connect your bank account instead of wiring money. But now bitcoin drops to $6000 instead of mooning. Do you <a class=\"squiffy-link link-section\" data-section=\"go leverage long\" role=\"link\" tabindex=\"0\">go leverage long</a> or <a class=\"squiffy-link link-section\" data-section=\"hold tight\" role=\"link\" tabindex=\"0\">hold tight</a> ?</p>",
		'passages': {
		},
	},
	'go leverage long': {
		'text': "<p>Bitcoin drops to $3100, just enough to liquidate you leaving you with zero bitcoin. You write a book about how bitcoin is a scam and is stupid and is for stupid people.</p>",
		'passages': {
		},
	},
	'hold tight': {
		'text': "<p>You hold on to your bitcoin hoard. You check the price every 5 minutes. You buy a blockclock showing the price but it just causes more anxiety. In 2021 bitcoin rises above $60k but you didn&#39;t come this far just to cash out. You mock people who &quot;cashed out&quot; to buy lambos and depreciating assets. Bitcoin crashes to $15k in 2022, and you quietly note that lambos don&#39;t depreciate 75% in a year. But you know that the game isn&#39;t over yet.</p>",
		'passages': {
		},
	},
	'buy a little bit': {
		'text': "<p>You buy a little bit. Bitcoin drops but you don&#39;t lose much sleep. You go on Bitcoin Twitter and see people advocating for DCA - Dollar Cost Averaging. Do you <a class=\"squiffy-link link-section\" data-section=\"begin a DCA\" role=\"link\" tabindex=\"0\">begin a DCA</a> or <a class=\"squiffy-link link-section\" data-section=\"keep your tiny stash\" role=\"link\" tabindex=\"0\">keep your tiny stash</a> ?</p>",
		'passages': {
		},
	},
	'begin a DCA': {
		'text': "<p>You set up an automatic DCA. Bitcoin goes up and you feel smart. Bitcoin goes down and you are happy because the same DCA is picking up more sats. You mock people who actually spend and use their bitcoin.</p>",
		'passages': {
		},
	},
	'keep your tiny stash': {
		'text': "<p>Bitcoin doesn&#39;t become a big part of your life, yet you note that you have more bitcoin than 21 million divided equally by the world&#39;s population. If bitcoin goes where the proponents think it will, perhaps your tiny stash is enough. On the other hand, what about all your relatives and friends who have pensions and fixed incomes that may have to rely on you in a hyperinflationary event? Do you truly have enough?</p>",
		'passages': {
		},
	},
	'get free coins': {
		'text': "<p>you go to a faucet run by Gavin and get 5 bitcoins. you are annoyed when you look at the value of 5 bitcoins and realize it won&#39;t buy you a coffee. Do you <a class=\"squiffy-link link-section\" data-section=\"keep the 5\" role=\"link\" tabindex=\"0\">keep the 5</a> or <a class=\"squiffy-link link-section\" data-section=\"discard them\" role=\"link\" tabindex=\"0\">discard them</a> ?</p>",
		'passages': {
		},
	},
	'keep the 5': {
		'text': "<p>You keep the 5 bitcoins. In 2017 you sell them for a sensible car that can reliably take you to the office. You look forward to Fridays. When people bring up bitcoin you make a face until they change the subject.</p>",
		'passages': {
		},
	},
	'discard them': {
		'text': "<p>You discard the bitcoins because the price would have to go up literally a million percent to be worth caring about. When the price does go up a million percent (10,000x), you don&#39;t tell anyone that you used to be a bitcoin OG because it&#39;s too embarassing.</p>",
		'passages': {
		},
	},
	'wire to gox': {
		'text': "<p>You wire money to Japan to fund your MtGox account. You buy bitcoins. \nDo you <a class=\"squiffy-link link-section\" data-section=\"withdraw your bitcoin to your computer\" role=\"link\" tabindex=\"0\">withdraw your bitcoin to your computer</a> or <a class=\"squiffy-link link-section\" data-section=\"keep them on MtGox\" role=\"link\" tabindex=\"0\">keep them on MtGox</a> ?</p>",
		'passages': {
		},
	},
	'keep them on MtGox': {
		'text': "<p>MtGox declares bankruptcy in February 2014. Do you <a class=\"squiffy-link link-section\" data-section=\"join the class action law suit\" role=\"link\" tabindex=\"0\">join the class action law suit</a> or <a class=\"squiffy-link link-section\" data-section=\"forget about your coins on MtGox\" role=\"link\" tabindex=\"0\">forget about your coins on MtGox</a> ?</p>",
		'passages': {
		},
	},
	'join the class action law suit': {
		'text': "<p>You fill out the paperwork and wait for what remains of your bitcoin to be returned to you. The years pass. It is 2023 and no bitcoins have been returned.</p>",
		'passages': {
		},
	},
	'forget about your coins on MtGox': {
		'text': "<p>You forget about that whole weird bitcoin thing until 2021 when bitcoin hits a high of $69,000. You think people are crazy to pay such a high price because you remember when the price was much lower. You wonder what happened to MtGox and struggle to remember how many coins you had.</p>",
		'passages': {
		},
	},
	'withdraw your bitcoin to your computer': {
		'text': "<p>You are going to withdraw the bitcoin - do you <a class=\"squiffy-link link-section\" data-section=\"use the wallet on your computer\" role=\"link\" tabindex=\"0\">use the wallet on your computer</a>, or <a class=\"squiffy-link link-section\" data-section=\"make a paper wallet\" role=\"link\" tabindex=\"0\">make a paper wallet</a> ? (Hardware wallets and phone wallets don&#39;t exist yet)</p>",
		'passages': {
		},
	},
	'use the wallet on your computer': {
		'text': "<p>You put the bitcoins on your computer wallet, but you later see the bitcoins were transferred out to someone else&#39;s address. Bitcoin wallets weren&#39;t encrypted or well-protected.\nYears later you <a class=\"squiffy-link link-section\" data-section=\"hear bitcoin hits 69k\" role=\"link\" tabindex=\"0\">hear bitcoin hits 69k</a> </p>",
		'passages': {
		},
	},
	'make a paper wallet': {
		'text': "<p>You make mistakes using a paper wallet and lose all your bitcoins.\nYears later you <a class=\"squiffy-link link-section\" data-section=\"hear bitcoin hits 69k\" role=\"link\" tabindex=\"0\">hear bitcoin hits 69k</a>  </p>",
		'passages': {
		},
	},
	'hear bitcoin hits 69k': {
		'text': "<p>You buy some bitcoin. The price drops to $50k. Do you <a class=\"squiffy-link link-section\" data-section=\"average down\" role=\"link\" tabindex=\"0\">average down</a> or <a class=\"squiffy-link link-section\" data-section=\"cut your losses\" role=\"link\" tabindex=\"0\">cut your losses</a> ?</p>",
		'passages': {
		},
	},
	'average down': {
		'text': "<p>You buy more but the price drops again. Do you <a class=\"squiffy-link link-section\" data-section=\"average down more\" role=\"link\" tabindex=\"0\">average down more</a> or <a class=\"squiffy-link link-section\" data-section=\"cut your losses\" role=\"link\" tabindex=\"0\">cut your losses</a> ?</p>",
		'passages': {
		},
	},
	'average down more': {
		'text': "<p>You buy more but the price drops again. Do you <a class=\"squiffy-link link-section\" data-section=\"average down even more\" role=\"link\" tabindex=\"0\">average down even more</a> or <a class=\"squiffy-link link-section\" data-section=\"cut your losses\" role=\"link\" tabindex=\"0\">cut your losses</a> ?</p>",
		'passages': {
		},
	},
	'average down even more': {
		'text': "<p>You buy more and the price drops further, but then a funny thing happens. The loop is broken. Bitcoin actually starts to go back up again. You forgot that it can do that. Bitcoin goes above your average price, then it goes above where you thought it was going to go, and then it goes a little further. You tell people how smart you were to buy bitcoin early and the people that were calling you an idiot for buying bitcoin are now telling you that you just got lucky.</p>",
		'passages': {
		},
	},
	'cut your losses': {
		'text': "<p>You sell the bitcoins at a loss. Maybe bitcoin isn&#39;t an easy path to wealth. Or maybe trading isn&#39;t for you. A friend sends you the classic post that created the HODL meme. The bitcoin price goes up again, but not to all time highs. You buy some more bitcoin and decide to lend it out to get yield while you wait for bitcoin to moon. Do you lend your bitcoin to <a class=\"squiffy-link link-section\" data-section=\"Celsius\" role=\"link\" tabindex=\"0\">Celsius</a>, <a class=\"squiffy-link link-section\" data-section=\"BlockFi\" role=\"link\" tabindex=\"0\">BlockFi</a>, or <a class=\"squiffy-link link-section\" data-section=\"Gemini Earn\" role=\"link\" tabindex=\"0\">Gemini Earn</a> ? </p>",
		'passages': {
		},
	},
	'Celsius': {
		'text': "<p>Withdrawals are disabled. You regret lending out your bitcoin.</p>",
		'passages': {
		},
	},
	'BlockFi': {
		'text': "<p>Withdrawals are disabled. You regret lending out your bitcoin.</p>",
		'passages': {
		},
	},
	'Gemini Earn': {
		'text': "<p>Withdrawals are disabled. You regret lending out your bitcoin.</p>",
		'passages': {
		},
	},
}
})();
"use strict";

import * as addSubtractDate from "add-subtract-date"
import * as formatoid from "formatoid"

const DATE_FORMAT1 = "MMM D, YYYY"
    , DATE_FORMAT2 = "MMMM D"

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function printDayCount(dayCount) {
    return  `${dayCount} ${(dayCount === 1) ? "day" : "days"}`
}

function addTooltips(container) {
    const tooltip = document.createElement("div")
    tooltip.classList.add("day-tooltip")
    container.appendChild(tooltip)

    // Add mouse event listener to show & hide tooltip
    const days = container.querySelectorAll(".ContributionCalendar-day");
    days.forEach(day => {
        day.addEventListener("mouseenter", (e) => {
            let contribCount = e.target.getAttribute("count");
            if (contribCount === "0") {
                contribCount = "No contributions"
            } else if (contribCount === "1") {
                contribCount = "1 contribution"
            } else {
                contribCount = `${contribCount} contributions`
            }
            const date = new Date(e.target.getAttribute("data-date"))
            const dateText = `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
            tooltip.innerHTML = `<strong>${contribCount}</strong> on ${dateText}`
            tooltip.classList.add("is-visible")
            const size = e.target.getBoundingClientRect()
                , leftPos = size.left + window.pageXOffset - tooltip.offsetWidth / 2 + size.width / 2
                , topPos = size.bottom + window.pageYOffset - tooltip.offsetHeight - 2 * size.height
            tooltip.style.top = `${topPos}px`
            tooltip.style.left = `${leftPos}px`
        })
        day.addEventListener("mouseleave", () => {
            tooltip.classList.remove("is-visible")
        })
    })
}

function parseGitHubCalendar(calendarHtml) {

    var data = {
        last_year: 0,
        longest_streak: -1,
        longest_streak_range: [],
        current_streak: 0,
        current_streak_range: [],
        longest_break: -1,
        longest_break_range: [],
        current_break: 0,
        current_break_range: [],
        weeks: [],
        days: [],
        last_contributed: null
    },
        lastWeek = [],
        updateLongestStreak = function updateLongestStreak() {
        if (data.current_streak > data.longest_streak) {
            data.longest_streak = data.current_streak;
            data.longest_streak_range[0] = data.current_streak_range[0];
            data.longest_streak_range[1] = data.current_streak_range[1];
        }
    },
        updateLongestBreak = function updateLongestBreak() {
        if (data.current_break > data.longest_break) {
            data.longest_break = data.current_break;
            data.longest_break_range[0] = data.current_break_range[0];
            data.longest_break_range[1] = data.current_break_range[1];
        }
    };
    calendarHtml.split("\n").slice(2).map(function (c) {
        return c.trim();
    }).forEach(function (c) {
        if (c.startsWith('<tr style="height: 11px">')) {
            return lastWeek.length && data.weeks.push(lastWeek) && (lastWeek = []);
        }

        var level = c.match(/data-level="([0-9\-]+)"/i),
            date = c.match(/data-date="([0-9\-]+)"/),
            count = c.match(/(No|[0-9]+)( contribution)/);

        level = level && level[1];
        date = date && date[1];
        if (count) {
            if (count[1] === "No") {
                count[1] = 0;
            }
            count = +count[1];
        } else {
            count = 0;
        }

        if (!level) {
            return;
        }
        const colorLegend = ["#eee", "#d6e685", "#8cc665", "#44a340", "#1e6823"];
        var fill = colorLegend[level];

        var obj = {
            fill: fill,
            date: new Date(date),
            count: count,
            level: level
        };

        if (data.current_streak === 0) {
            data.current_streak_range[0] = obj.date;
        }

        if (data.current_break === 0) {
            data.current_break_range[0] = obj.date;
        }

        if (obj.count) {
            ++data.current_streak;
            data.last_year += obj.count;
            data.last_contributed = obj.date;
            data.current_streak_range[1] = obj.date;

            updateLongestBreak();
            data.current_break = 0;
        } else {
            updateLongestStreak();
            data.current_streak = 0;

            ++data.current_break;
            data.current_break_range[1] = obj.date;
        }

        lastWeek.push(obj);
        data.days.push(obj);
    });

    updateLongestStreak();

    return data;
};

function fillCellsWithColor(calendarHtml){
    const calendarTag = document.createElement("div")
    calendarTag.innerHTML = calendarHtml
    calendarTag.querySelectorAll(".ContributionCalendar-day").forEach(day => {
        const level = day.getAttribute("data-level")
        const colorLegend = ["#eee", "#d6e685", "#8cc665", "#44a340", "#1e6823"];
        const fill = colorLegend[level];
        day.setAttribute("fill", fill)
        day.setAttribute("count", day.textContent.split(" ")[0])
        day.innerHTML = `<rect style="display: block; background-color: ${fill}; width: 1em; height: 1em; border-radius: 2px; margin: 0 auto;"></rect>`
    })
    return calendarTag.innerHTML
    
}

/**
 * GitHubCalendar
 * Brings the contributions calendar from GitHub (provided username) into your page.
 *
 * @name GitHubCalendar
 * @function
 * @param {String|HTMLElement} container The calendar container (query selector or the element itself).
 * @param {String} username The GitHub username.
 * @param {Object} options An object containing the following fields:
 *
 *    - `summary_text` (String): The text that appears under the calendar (defaults to: `"Summary of
 *      pull requests, issues opened, and commits made by <username>"`).
 *    - `proxy` (Function): A function that receives as argument the username (string) and should return a promise resolving the HTML content of the contributions page.
 *      The default is using @Bloggify's APIs.
 *    - `global_stats` (Boolean): If `false`, the global stats (total, longest and current streaks) will not be calculated and displayed. By default this is enabled.
 *    - `responsive` (Boolean): If `true`, the graph is changed to scale with the container. Custom CSS should be applied to the element to scale it appropriately. By default this is disabled.
 *    - `tooltips` (Boolean): If `true`, tooltips will be shown when hovered over calendar days. By default this is disabled.
 *    - `cache` (Number) The cache time in seconds.
 *
 * @return {Promise} A promise returned by the `fetch()` call.
 */
module.exports = function GitHubCalendar (container, username, options) {

    container = document.querySelector(container);

    options = options || {}
    options.summary_text = options.summary_text || `Summary of pull requests, issues opened, and commits made by <a href="https://github.com/${username}" target="blank">@${username}</a>`
    options.cache = (options.cache || (24 * 60 * 60)) * 1000

    if (options.global_stats === false) {
        container.style.minHeight = "175px"
    }

    const cacheKeys = {
        content: `gh_calendar_content.${username}`,
        expire_at: `gh_calendar_expire.${username}`
    }

    // We need a proxy for CORS
    options.proxy = options.proxy || (username => {
        return fetch(`https://api.bloggify.net/gh-calendar/?username=${username}`).then(r => r.text())
    })

    options.getCalendar = options.getCalendar || (username => {
        if (options.cache && Date.now() < +localStorage.getItem(cacheKeys.expire_at)) {
            const content = localStorage.getItem(cacheKeys.content)
            if (content) {
                return Promise.resolve(content)
            }
        }

        return options.proxy(username).then(body => {
            if (options.cache) {
                localStorage.setItem(cacheKeys.content, body)
                localStorage.setItem(cacheKeys.expire_at, Date.now() + options.cache)
            }
            return body
        })
    })

    let fetchCalendar = () => options.getCalendar(username).then(body => {
        let div = document.createElement("div")
        div.innerHTML = body
        let cal = div.querySelector(".js-yearly-contributions")
        const headerToRemove = cal.querySelector(".position-relative h2");
        if (headerToRemove) {
            headerToRemove.remove();
        }

        //cal.querySelector(".float-left.text-gray").innerHTML = options.summary_text

        // Remove 3d visualiser div
        for (const a of div.querySelectorAll("a")) {
            if (a.textContent.includes("View your contributions in 3D, VR and IRL!")) {
                a.parentElement.remove()
            }
        }

        cal.querySelectorAll("tr").forEach(tr => {
            tr.setAttribute("style", "height: 2em")
        })
        cal.querySelectorAll("span[aria-hidden='true']").forEach(span => {
            // set position to relative
            span.setAttribute("style", "position: relative")
        });
        cal.querySelectorAll(".ContributionCalendar-label").forEach(label => {
            // text-align left 
            label.setAttribute("style", "text-align: left")
        });
        cal.querySelector("table").setAttribute("style", "width: 100%")

        // If 'include-fragment' with spinner img loads instead of the svg, fetchCalendar again
        if (cal.querySelector("include-fragment")) {
            setTimeout(fetchCalendar, 500)
        } else {
            if (options.global_stats !== false) {

                let parsed = parseGitHubCalendar(cal.outerHTML)
                   let currentStreakInfo = parsed.current_streak
                                      ? `${formatoid(parsed.current_streak_range[0], DATE_FORMAT2)} &ndash; ${formatoid(parsed.current_streak_range[1], DATE_FORMAT2)}`
                                      : parsed.last_contributed
                                      ? `Last contributed in ${formatoid(parsed.last_contributed, DATE_FORMAT2)}.`
                                      : "Rock - Hard Place"
                  , longestStreakInfo = parsed.longest_streak
                                      ? `${formatoid(parsed.longest_streak_range[0], DATE_FORMAT2)} &ndash; ${formatoid(parsed.longest_streak_range[1], DATE_FORMAT2)}`
                                      : parsed.last_contributed
                                      ? `Last contributed in ${formatoid(parsed.last_contributed, DATE_FORMAT2)}.`
                                      : "Rock - Hard Place"
                    const firstCol = document.createElement("div");
                    firstCol.classList.add("contrib-column", "contrib-column-first", "table-column");
                    firstCol.innerHTML = `<span class="text-muted">Contributions in the last year</span>
                                        <span class="contrib-number">${parsed.last_year} total</span>
                                        <span class="text-muted">${formatoid(addSubtractDate.add(addSubtractDate.subtract(new Date(), 1, "year"), 1, "day"), DATE_FORMAT1)} &ndash; ${formatoid(new Date(), DATE_FORMAT1)}</span>`;
                    
                    const secondCol = document.createElement("div");
                    secondCol.classList.add("contrib-column", "table-column");
                    secondCol.innerHTML = `<span class="text-muted">Longest streak</span>
                                        <span class="contrib-number">${printDayCount(parsed.longest_streak)}</span>
                                        <span class="text-muted">${longestStreakInfo}</span>`;
                    
                    const thirdCol = document.createElement("div");
                    thirdCol.classList.add("contrib-column", "table-column");
                    thirdCol.innerHTML = `<span class="text-muted">Current streak</span>
                                        <span class="contrib-number">${printDayCount(parsed.current_streak)}</span>
                                        <span class="text-muted">${currentStreakInfo}</span>`;
                                      

                cal.appendChild(firstCol)
                cal.appendChild(secondCol)
                cal.appendChild(thirdCol)
            }
            cal.innerHTML = fillCellsWithColor(cal.innerHTML)
            container.innerHTML = cal.innerHTML

            // If options includes tooltips, add tooltips listeners to SVG
            // if (options.tooltips === true) {
                addTooltips(container)
            // }
        }
    }).catch(e => console.error(e))

    return fetchCalendar()
}

export default module.exports
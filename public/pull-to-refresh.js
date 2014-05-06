$(function() {
	var touchPos = {
		x: 0,
		y: 0
	}

	var PULL_BOTTOM = -36;
	var pullAmount = PULL_BOTTOM;

	var pullingToRefresh = false;


	var extractTouchPositionFromEvent = function(event) {
		if (event.originalEvent.touches && event.originalEvent.touches.length > 0) {
			return {
				x: event.originalEvent.touches[0].clientX,
				y: event.originalEvent.touches[0].clientY,
			}
		}
	}

	$(window).on("touchstart", function(event) {
		touchPos = extractTouchPositionFromEvent(event);
	});

	$(window).on("touchmove", function(event) {
		var mousePos = extractTouchPositionFromEvent(event);

		var yDiff = touchPos.y - mousePos.y;

		var correctTarget = $(event.target).parents("#portfolio").length > 0 || event.target.id == "portfolio";
		var correctScrollAmount = (pullAmount == PULL_BOTTOM && yDiff < 0) || (pullAmount > PULL_BOTTOM);
		var scrolledToTop = $("#portfolio").scrollTop() == 0;

		if (correctTarget && !window.noPortfolio && scrolledToTop && correctScrollAmount) {
			pullAmount -= yDiff;
			if (pullAmount > 0) {
				pullAmount = 0;
			}
			if (pullAmount < PULL_BOTTOM) {
				pullAmount = PULL_BOTTOM;
			}

			$(".pull-to-refresh").css({
				"margin-top": pullAmount + "px",
				transition: "0"
			});

			pullingToRefresh = true;

			if (pullAmount != 0) {
				$(".pull-to-refresh-text").html("Pull to refresh");
				$(".pull-to-refresh i").addClass("fa-chevron-up").removeClass("fa-chevron-down");
			} else {
				$(".pull-to-refresh-text").html("Release to refresh");
				$(".pull-to-refresh i").addClass("fa-chevron-down").removeClass("fa-chevron-up");
			}

			event.preventDefault();
		}
		touchPos = mousePos;
	});

	$(window).on("touchend", function(event) {
		if (pullingToRefresh && pullAmount == 0) {
			if (window.onPullToRefresh) window.onPullToRefresh();

			$(".pull-to-refresh").css({
				transition: "all 200ms ease-in-out",
				"margin-top": PULL_BOTTOM + "px"
			});

			pullAmount = PULL_BOTTOM;
		} else if (pullingToRefresh) {
			$(".pull-to-refresh").css({
				transition: "all 200ms ease-in-out",
				"margin-top": PULL_BOTTOM + "px"
			});

			pullAmount = PULL_BOTTOM;
		}

		if (pullingToRefresh) {
			event.preventDefault();
			event.stopPropagation();
		}

		pullingToRefresh = false;
	});
});
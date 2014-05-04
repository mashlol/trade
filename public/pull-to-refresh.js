$(function() {
	var touchPos = {
		x: 0,
		y: 0
	}

	window.pullAmount = -50;

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

		if ($(".container").scrollTop() == 0 && (window.pullAmount == -50 && yDiff < 0) || (window.pullAmount > -50)) {
			window.pullAmount -= yDiff;
			if (window.pullAmount > 0) {
				window.pullAmount = 0;
			}
			if (window.pullAmount < -50) {
				window.pullAmount = -50;
			}

			$(".search").css({
				"margin-top": window.pullAmount + "px",
				transition: "0"
			});
			event.preventDefault();
		}
		touchPos = mousePos;
	});
});
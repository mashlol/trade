// TODO pull all top level `(function(){})();` into separate files

(function() {
	var decimalPlacer = function(amount, numDecimals) {
		if (amount.toString().split(".").length == 1) {
			amount += ".";
			for (var x=0; x<numDecimals; x++) {
				amount += "0";
			}
			return amount;
		}

		var decimals = amount.toString().split(".")[1];

		if (decimals.length > numDecimals) {
			decimals = decimals.substring(0, numDecimals);
		}

		for (var x=0; x<numDecimals-decimals.length; x++) {
			decimals += "0";
		}

		return amount.toString().split(".")[0] + "." + decimals;
	};

	window.formatMoney = function(amount) {
		if (amount < 1000) {
			return "$" + decimalPlacer(amount, 2) + "";
		}
		if (amount < 1000000) {
			return "$" + decimalPlacer(amount / 1000, 1) + "K";
		}
		return "$" + decimalPlacer(amount / 1000000, 1) + "M";
	};
})();

(function() {
	var Search = {};

	Search.stocks = [];

	Search.add = function(stock) {
		this.stocks.push(stock);
	};

	Search.addStocksBySymbols = function(symbols, callback) {
		$("#search .stock-list .stock").remove();

		this.stocks = [];

		var _this = this;
		Stock.findBySymbols(symbols, function(jsonResults) {
			console.log(symbols);
			console.log(jsonResults);
			var newStocks = [];
			if (jsonResults.query.results.quote.length) {
				for (var x in jsonResults.query.results.quote) {
					if (!jsonResults.query.results.quote[x].ErrorIndicationreturnedforsymbolchangedinvalid) {
						var stk = new Stock(jsonResults.query.results.quote[x]);
						newStocks.push(stk);
					}
				}
			} else {
				if (!jsonResults.query.results.quote.ErrorIndicationreturnedforsymbolchangedinvalid) {
					var stk = new Stock(jsonResults.query.results.quote);
					newStocks.push(stk);
				}
			}

			for (var x in newStocks) {
				// TODO don't use window.portfolio
				_this.add(new StockView(newStocks[x], window.portfolio, true));
			}

			if (callback) callback();
		});
	};

	window.Search = Search;
})();

(function() {
	var Portfolio = function() {
		this.stocks = [];
		this.money = 0;
	};

	Portfolio.prototype.contains = function(stock) {
		for (var x in this.stocks) {
			if (this.stocks[x].symbol == stock.symbol) {
				return true;
			}
		}
		return false;
	}

	Portfolio.prototype.add = function(stock) {
		if (!this.contains(stock)) {
			this.stocks.push(stock);
			new StockView(stock, this);
		}
	};

	Portfolio.prototype.addStocksBySymbols = function(symbols, callback) {
		var _this = this;
		Stock.findBySymbols(symbols, function(jsonResults) {
			var newStocks = [];
			if (jsonResults.query.results.quote.length) {
				for (var x in jsonResults.query.results.quote) {
					_this.add(new Stock(jsonResults.query.results.quote[x]));
				}
			} else {
				_this.add(new Stock(jsonResults.query.results.quote));
			}

			if (callback) callback();
		});
	};

	Portfolio.prototype.toJSON = function() {
		var stocks = [];
		for (var x in this.stocks) {
			stocks[x] = this.stocks[x].toJSON();
		}

		return {
			stocks: stocks,
			money: this.money
		}
	};

	Portfolio.prototype.save = function() {
		window.localStorage.trade = JSON.stringify(this);
	};

	Portfolio.load = function(callback) {
		var portfolio = new Portfolio();
		if (window.localStorage.trade) {
			var jsonInfo = JSON.parse(window.localStorage.trade);

			var symbols = [];
			for (var x in jsonInfo.stocks) {
				symbols.push(jsonInfo.stocks[x].symbol);
			}

			portfolio.money = jsonInfo.money;

			var finished = function() {
				for (var x in portfolio.stocks) {
					portfolio.stocks[x].amountOwned = jsonInfo.stocks[x].amountOwned;
				}
				for (var x in StockView.stockViews) {
					StockView.stockViews[x].render();
				}
				if (callback) callback(portfolio);
				portfolio.updateMoneyAmount();
			}

			if (symbols.length > 0) {
				portfolio.addStocksBySymbols(symbols, finished);
				window.noPortfolio = false;
				$(".no-portfolio").hide();
			} else {
				if (callback) callback(portfolio);
				window.noPortfolio = true;
				$(".no-portfolio").show();
			}
		} else {
			portfolio.money = 10000;
			portfolio.updateMoneyAmount();

			if (callback) callback(portfolio);
		}
		return portfolio;
	};

	Portfolio.prototype.refresh = function(callback) {
		// Build list of symbols in portfolio
		var symbols = [];
		for (var x in this.stocks) {
			symbols.push(this.stocks[x].symbol);
		}

		Stock.findBySymbols(symbols, function(jsonResults) {
			// Update the stock prices, etc
			if (jsonResults.query.results.quote.length) {
				for (var x in jsonResults.query.results.quote) {
					var stockJsonResult = jsonResults.query.results.quote[x];
					Stock.stocks[stockJsonResult.Symbol].update(stockJsonResult);
				}
			} else {
				var stockJsonResult = jsonResults.query.results.quote;
				Stock.stocks[stockJsonResult.Symbol].update(stockJsonResult);
			}

			// Now update all StockViews
			for (var x in StockView.stockViews) {
				StockView.stockViews[x].render();
			}

			if (callback) callback();
		});
	};

	Portfolio.prototype.updateMoneyAmount = function() {
		var totalMoney = this.money;

		for (var x in this.stocks) {
			totalMoney += this.stocks[x].price * this.stocks[x].amountOwned;
		}

		$(".money-amt").html(window.formatMoney(this.money) + " (" + window.formatMoney(totalMoney) + ")");
	}

	window.Portfolio = Portfolio;
})();

(function() {
	var Stock = function(jsonResult) {
		this.symbol = jsonResult.symbol;
		this.name = jsonResult.Name;
		this.update(jsonResult);

		this.amountOwned = 0;

		if (Stock.stocks[this.symbol]) {
			return Stock.stocks[this.symbol];
		}

		Stock.stocks[this.symbol] = this;
	};

	Stock.stocks = {};

	Stock.prototype.update = function(jsonResult) {
		this.price = jsonResult.LastTradePriceOnly;
		this.points = jsonResult.Change;
		this.percent = jsonResult.PercentChange;
	}

	Stock.prototype.buy = function(amount, portfolio) {
		if (portfolio.money >= this.price * amount) {
			portfolio.money -= this.price * amount;
			this.amountOwned += amount || 1;

			portfolio.add(this);

			History.add(new Transaction(this.symbol, amount, Date.now(), false, this.price * amount));

			portfolio.updateMoneyAmount();
			return "Successfully purchased " + amount + " shares of " + this.symbol + ".";
		}
		return "You don't have enough money for that!";
	};

	Stock.prototype.sell = function(amount, portfolio) {
		amount = amount || 1;
		if (this.amountOwned >= amount) {
			portfolio.money += parseFloat(this.price) * amount;
			this.amountOwned -= amount;

			History.add(new Transaction(this.symbol, amount, Date.now(), true, this.price * amount));

			portfolio.updateMoneyAmount();
			return "Successfully sold " + amount + " shares of " + this.symbol + ".";
		}
		return "You don't have that many to sell.";
	};

	Stock.findBySymbols = function(symbols, callback) {
		for (var x in symbols) {
			symbols[x] = "\"" + symbols[x] + "\"";
		}

		var symbolString = symbols.join(", ");

		API.queryStockSymbols(symbolString, callback);
	};

	Stock.prototype.toJSON = function() {
		return {
			symbol: this.symbol,
			amountOwned: this.amountOwned
		}
	};

	window.Stock = Stock;
})();

(function() {
	var History = {};

	History.transactions = [];

	History.load = function() {
		if (window.localStorage.tradeHistory) {
			var history = JSON.parse(window.localStorage.tradeHistory);
			for (var x in history) {
				this.add(new Transaction(history[x].symbol, history[x].amount, history[x].date, history[x].sold, history[x].price));
			}
		} else {
			$(".no-history").show();
		}
	};

	History.save = function() {
		window.localStorage.tradeHistory = JSON.stringify(this.transactions);
	};

	History.add = function(transaction) {
		this.transactions.push(transaction);

		new HistoryView(transaction);
		$(".no-history").hide();

		this.save();
	};

	window.History = History;
})();

(function() {
	var Transaction = function(symbol, amount, date, sold, price) {
		this.symbol = symbol;
		this.amount = amount;
		this.date = date;
		this.sold = sold;
		this.price = price;
	};

	Transaction.prototype.toJSON = function() {
		return {
			symbol: this.symbol,
			amount: this.amount,
			date: this.date,
			sold: this.sold,
			price: this.price
		}
	};

	window.Transaction = Transaction;
})();

(function() {
	var HistoryView = function(transaction) {
		this.transaction = transaction;

		this.$el = $("#template-history").children().eq(0).clone();

		$(".history-list").prepend(this.$el);

		this.render();
	};

	HistoryView.prototype.render = function() {
		if (this.transaction.sold) {
			this.$el.find(".bought-sold").addClass("sold").removeClass("bought");
			this.$el.find(".bought-sold").html("sold");
		} else {
			this.$el.find(".bought-sold").addClass("bought").removeClass("sold");
			this.$el.find(".bought-sold").html("purchased");
		}

		this.$el.find(".sym").html(this.transaction.symbol);
		this.$el.find(".amt").html(this.transaction.amount);
		this.$el.find(".date").html(new Date(this.transaction.date).toLocaleString());
		this.$el.find(".price").html(window.formatMoney(this.transaction.price));
		this.$el.find(".price-each").html(window.formatMoney(this.transaction.price / this.transaction.amount));
	};

	window.HistoryView = HistoryView;
})();

(function() {
	var StockView = function(stock, portfolio, search) {
		this.stock = stock;
		this.portfolio = portfolio;

		this.search = search;

		this.tradeAmount = 1;

		this.$el = $("#template-stock").children().eq(0).clone();
		this.render();
		this.events();
		if (!search) {
			$(".portfolio .stock-list").append(this.$el);
		} else {
			$("#search .stock-list").append(this.$el);
		}

		var _this = this;
		setTimeout(function() {
			_this.$el.css({
				opacity: 1
			});
		}, 100);

		StockView.stockViews.push(this);
	};

	StockView.updateStockViewsBySymbol = function(symbol) {
		for (var x in this.stockViews) {
			if (this.stockViews[x].stock.symbol == symbol) {
				this.stockViews[x].render();
			}
		}
	}

	StockView.stockViews = [];

	StockView.prototype.events = function() {
		this.$el.on("click", this.onClick.bind(this));

		this.$el.find(".buy-button").on("click", this.buy.bind(this));
		this.$el.find(".sell-button").on("click", this.sell.bind(this));
		this.$el.find(".incr-button").on("click", this.incr.bind(this));
		this.$el.find(".decr-button").on("click", this.decr.bind(this));
		this.$el.find(".portfolio-remove").on("click", this.remove.bind(this));

		this.$el.find(".amount-trading").on("click", function(event) {
			event.preventDefault();
			event.stopPropagation();
		});

		this.$el.find(".amount-trading").focusout(this.onTradeAmountDefocus.bind(this));
	};

	StockView.prototype.remove = function(event) {
		event.preventDefault();
		event.stopPropagation();

		if (this.search) {
			this.portfolio.add(this.stock);

			this.portfolio.save();
			this.render();
			return;
		}

		for (var x in this.portfolio.stocks) {
			if (this.portfolio.stocks[x].symbol == this.stock.symbol) {
				this.portfolio.stocks.splice(x, 1);
				break;
			}
		}

		this.$el.remove();

		if ($(".portfolio .stock-list .stock").length == 0) {
			$(".no-portfolio").show();
			window.noPortfolio = true;
		} else {
			window.noPortfolio = false;
			$(".no-portfolio").hide();
		}

		this.portfolio.save();
	};

	StockView.prototype.buy = function(event) {
		event.preventDefault();
		event.stopPropagation();

		this.stock.buy(this.tradeAmount, this.portfolio);
		this.portfolio.save();

		StockView.updateStockViewsBySymbol(this.stock.symbol);

		if ($(".portfolio .stock-list .stock").length == 0) {
			$(".no-portfolio").show();
			window.noPortfolio = true;
		} else {
			window.noPortfolio = false;
			$(".no-portfolio").hide();
		}
	};

	StockView.prototype.sell = function(event) {
		event.preventDefault();
		event.stopPropagation();

		this.stock.sell(this.tradeAmount, this.portfolio);
		this.portfolio.save();

		StockView.updateStockViewsBySymbol(this.stock.symbol);
	};

	StockView.prototype.incr = function(event) {
		event.preventDefault();
		event.stopPropagation();

		this.tradeAmount++;

		if (this.tradeAmount > this.stock.amountOwned && this.tradeAmount * this.stock.price > this.portfolio.money) {
			this.tradeAmount--;
		}
		this.render();
	}

	StockView.prototype.decr = function(event) {
		event.preventDefault();
		event.stopPropagation();

		this.tradeAmount--;
		if (this.tradeAmount < 1) {
			this.tradeAmount = 1;
		}
		this.render();
	}

	StockView.prototype.onClick = function() {
		this.$el.toggleClass("flipped");
	};

	StockView.prototype.onTradeAmountDefocus = function() {
		this.tradeAmount = Math.min(
			Math.max(
				Math.max(this.stock.amountOwned, 1),
				Math.floor(this.portfolio.money / (this.tradeAmount * this.stock.price))
			),
			parseInt(this.$el.find(".amount-trading").val()) || 1
		)

		this.render();
	}

	StockView.prototype.render = function() {
		this.$el.find(".symbol").html(this.stock.symbol);
		this.$el.find(".price").html(this.stock.price);
		this.$el.find(".percent").html(this.stock.percent.substr(1));
		this.$el.find(".points").html(this.stock.points.substr(1));
		this.$el.find(".name").html(this.stock.name);

		if (parseFloat(this.stock.points) > 0) {
			this.$el.find(".points").addClass("green");
			this.$el.find(".percent").addClass("green");
		} else {
			this.$el.find(".points").addClass("red");
			this.$el.find(".percent").addClass("red");
		}

		this.$el.find(".amount-owned-num").html(this.stock.amountOwned);

		if (this.stock.amountOwned == 0) {
			this.$el.find(".sell-button").prop("disabled", true);
			this.$el.find(".portfolio-remove").prop("disabled", false);
		} else {
			this.$el.find(".sell-button").prop("disabled", false);
			this.$el.find(".portfolio-remove").prop("disabled", true);
		}

		if (this.search) {
			this.$el.find(".portfolio-remove").html("Add").addClass("portfolio-add");

			if (this.portfolio.contains(this.stock)) {
				this.$el.find(".portfolio-remove").prop("disabled", true);
			} else {
				this.$el.find(".portfolio-remove").prop("disabled", false);
			}
		}

		if (this.tradeAmount * this.stock.price > this.portfolio.money) {
			this.$el.find(".buy-button").prop("disabled", true);
		} else {
			this.$el.find(".buy-button").prop("disabled", false);
		}

		this.$el.find(".amount-trading").val(this.tradeAmount);

		this.$el.find(".total-value-num").html(window.formatMoney(this.stock.amountOwned * this.stock.price));


		// TODO move this somewhere smarter
		if ($(".portfolio .stock-list .stock").length == 0) {
			$(".no-portfolio").show();
		} else {
			$(".no-portfolio").hide();
		}
	};

	StockView.findByStock = function(stock) {
		for (var x in StockView.stockViews) {
			if (StockView.stockViews[x].stock.symbol == stock.symbol) {
				return StockView.stockViews[x];
			}
		}

		return false;
	};

	window.StockView = StockView;
})();

(function() {
	var LoadFlipper = function($loadBar, speed) {
		this.$loadBar = $loadBar;
		this.speed = speed;

		this.$loadBar.css({
			transition: "all " + Math.floor(speed / 2) + "ms ease-in-out"
		});

		console.log("Started at " + Date.now());

		this.start();
	};

	LoadFlipper.prototype.start = function() {
		this.$loadBar.toggleClass("rotated");

		this.timer = setTimeout(this.start.bind(this), Math.floor(this.speed / 2));
	};

	LoadFlipper.prototype.stop = function() {
		clearTimeout(this.timer);
	};

	var Loader = function(element, speed, prepend) {
		speed = speed || 1000;
		this.$el = $("#template-loader").children().eq(0).clone();

		this.flippers = [];
		var _this = this;

		console.log("Start time should be: " + (Date.now() + Math.floor((speed / 3) * 0)));
		console.log("Start time should be: " + (Date.now() + Math.floor((speed / 3) * 1)));
		console.log("Start time should be: " + (Date.now() + Math.floor((speed / 3) * 2)));

		setTimeout(function() {
			_this.flippers.push(new LoadFlipper(_this.$el.find(".load-bar").eq(0), speed));
		}, Math.floor((speed / 3) * 0));

		setTimeout(function() {
			_this.flippers.push(new LoadFlipper(_this.$el.find(".load-bar").eq(1), speed));
		}, Math.floor((speed / 3) * 1));

		setTimeout(function() {
			_this.flippers.push(new LoadFlipper(_this.$el.find(".load-bar").eq(2), speed));
		}, Math.floor((speed / 3) * 2));

		if (prepend)
			element.prepend(this.$el);
		else
			element.append(this.$el);
	};

	Loader.prototype.stop = function() {
		for (var x in this.flippers) {
			this.flippers[x].stop();
		}

		this.$el.remove();
	};

	window.Loader = Loader;
})();

(function() {
	var API = {};

	API.queryStockSymbols = function(symbols, callback) {
		$.getJSON("https://query.yahooapis.com/v1/public/yql?q=select * from yahoo.finance.quotes where symbol in (" + symbols + ")%0A%09%09&format=json&diagnostics=true&env=http%3A%2F%2Fdatatables.org%2Falltables.env&callback=", callback)
	};

	API.query = function(search, callback) {
		console.log("QUERYING: " + search);
		$.getJSON("/search?q=" + search, callback);
	}

	window.API = API;
})();

$(function() {
	History.load();
	var loader = new Loader($(".portfolio"), 1000);
	var portfolio = Portfolio.load(function(portfolio) {
		loader.stop();

		if ($(".portfolio .stock-list .stock").length == 0) {
			$(".no-portfolio").show();
			window.noPortfolio = true;
		} else {
			window.noPortfolio = false;
			$(".no-portfolio").hide();
		}
	});

	window.portfolio = portfolio;

	$(".tab").on("click", function() {
		var offset = $(this).data("tab-offset");
		$(".tab-containers").css({
			transform: "translate3d(" + offset + ",0,0)"
		});
		$(".tab").removeClass("selected");
		$(this).addClass("selected");

		$(".title h1").html($(this).data("tab-name"));

		$(".tabs .selected-bar").css({
			transform: "translate3d(" + (-parseInt(offset)) + "%" + ",0,0)",
		});
	});


	$(".search-bar").on("click", ".fa-times", function() {
		$(".search-bar input").val("");
		$(".search-bar .fa-times").removeClass("fa-times").addClass("fa-search");
		$("#search .stock-list .stock").hide();
		clearTimeout(timer);
		$(".search-bar input").focus();
	});

	var searching = false;
	var timer;
	var loader;
	$(".search-bar input").on("keyup", function() {
		var query = $(this).val();
		searching = false;
		clearTimeout(timer);
		if (loader) loader.stop();

		if (query) {
			$(".search-bar .fa-search").removeClass("fa-search").addClass("fa-times");
		} else {
			$(".search-bar .fa-times").removeClass("fa-times").addClass("fa-search");
		}

		if (query.length > 1) {
			timer = setTimeout(function() {
				searching = true;
				$(".no-results").hide();
				loader = new Loader($("#search"));
				API.query(query, function(results) {
					var symbols = [];
					for (var x=0; x<Math.min(20, results.companies.length); x++) {
						var company = results.companies[x];
						symbols.push(company.symbol);
					}
					if (symbols.length >= 1) {
						Search.addStocksBySymbols(symbols, function() {
							loader.stop();
						});
					} else {
						$("#search .stock-list .stock").hide();
						$(".no-results").show();
						loader.stop();
					}
				});
			}, 300);
		}
	});

	$("#search-form").submit(function() {
		$(".search-bar input").blur();

		return false;
	});

	window.onPullToRefresh = function() {
		$(".portfolio .stock-list .stock").css({
			transition: "all 50ms ease-in-out",
			opacity: 0
		});
		var loader = new Loader($(".portfolio"), 600, true);
		portfolio.refresh(function() {
			loader.stop();

			$(".portfolio .stock-list .stock").css({
				transition: "all 300ms ease-in-out",
				opacity: 1
			});
		});
	};
});
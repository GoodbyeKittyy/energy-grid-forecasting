%% Quantile Regression for Energy Forecasting
% MATLAB implementation for probabilistic energy forecasts
% Provides P10, P50, P90 quantile predictions for risk management

function quantile_regression()
    fprintf('========================================\n');
    fprintf('QUANTILE REGRESSION ANALYSIS\n');
    fprintf('Probabilistic Energy Forecasting\n');
    fprintf('========================================\n\n');
    
    %% Generate Synthetic Training Data
    fprintf('[1] Generating synthetic training data...\n');
    n_hours = 2160; % 90 days
    [X_train, y_solar_train, y_wind_train] = generate_training_data(n_hours);
    fprintf('    Generated %d hours of training data\n\n', n_hours);
    
    %% Train Quantile Regression Models
    fprintf('[2] Training quantile regression models...\n');
    quantiles = [0.1, 0.5, 0.9]; % P10, P50, P90
    
    % Solar models
    solar_models = cell(1, length(quantiles));
    for i = 1:length(quantiles)
        fprintf('    Training solar P%d model...\n', round(quantiles(i)*100));
        solar_models{i} = train_quantile_model(X_train, y_solar_train, quantiles(i));
    end
    
    % Wind models
    wind_models = cell(1, length(quantiles));
    for i = 1:length(quantiles)
        fprintf('    Training wind P%d model...\n', round(quantiles(i)*100));
        wind_models{i} = train_quantile_model(X_train, y_wind_train, quantiles(i));
    end
    fprintf('\n');
    
    %% Generate 24-Hour Forecast
    fprintf('[3] Generating 24-hour probabilistic forecast...\n');
    n_forecast = 24;
    X_forecast = generate_forecast_features(n_forecast);
    
    % Solar forecasts
    solar_p10 = predict_quantile(X_forecast, solar_models{1});
    solar_p50 = predict_quantile(X_forecast, solar_models{2});
    solar_p90 = predict_quantile(X_forecast, solar_models{3});
    
    % Wind forecasts
    wind_p10 = predict_quantile(X_forecast, wind_models{1});
    wind_p50 = predict_quantile(X_forecast, wind_models{2});
    wind_p90 = predict_quantile(X_forecast, wind_models{3});
    
    fprintf('    Forecast complete\n\n');
    
    %% Display Forecast Summary
    fprintf('[4] FORECAST SUMMARY (Next 12 Hours)\n');
    fprintf('------------------------------------------------------------\n');
    fprintf('Hour   Solar-P10  Solar-P50  Solar-P90  Wind-P10   Wind-P50   Wind-P90\n');
    fprintf('------------------------------------------------------------\n');
    
    for h = 1:12
        fprintf('%02d:00  %.3f      %.3f      %.3f      %.3f      %.3f      %.3f\n', ...
            h-1, solar_p10(h), solar_p50(h), solar_p90(h), ...
            wind_p10(h), wind_p50(h), wind_p90(h));
    end
    fprintf('\n');
    
    %% Calculate Uncertainty Metrics
    fprintf('[5] UNCERTAINTY METRICS\n');
    fprintf('------------------------------------------------------------\n');
    
    % Prediction intervals
    solar_interval = mean(solar_p90 - solar_p10);
    wind_interval = mean(wind_p90 - wind_p10);
    
    fprintf('Average Solar Prediction Interval (P10-P90): %.3f\n', solar_interval);
    fprintf('Average Wind Prediction Interval (P10-P90): %.3f\n', wind_interval);
    
    % Coefficient of variation
    solar_cv = std(solar_p50) / mean(solar_p50);
    wind_cv = std(wind_p50) / mean(wind_p50);
    
    fprintf('Solar Coefficient of Variation: %.3f\n', solar_cv);
    fprintf('Wind Coefficient of Variation: %.3f\n\n', wind_cv);
    
    %% Risk Analysis
    fprintf('[6] RISK ANALYSIS\n');
    fprintf('------------------------------------------------------------\n');
    
    demand = 0.65; % Typical demand level
    
    % Calculate probability of shortfall
    total_p10 = solar_p10 + wind_p10;
    total_p50 = solar_p50 + wind_p50;
    total_p90 = solar_p90 + wind_p90;
    
    shortfall_p10 = sum(total_p10 < demand) / n_forecast * 100;
    shortfall_p50 = sum(total_p50 < demand) / n_forecast * 100;
    shortfall_p90 = sum(total_p90 < demand) / n_forecast * 100;
    
    fprintf('Probability of Supply Shortfall:\n');
    fprintf('  P10 scenario: %.1f%%\n', shortfall_p10);
    fprintf('  P50 scenario: %.1f%%\n', shortfall_p50);
    fprintf('  P90 scenario: %.1f%%\n\n', shortfall_p90);
    
    %% Visualization
    fprintf('[7] Generating visualizations...\n');
    
    % Create figure
    figure('Position', [100, 100, 1200, 800]);
    
    % Solar forecast plot
    subplot(2, 2, 1);
    hours = 0:n_forecast-1;
    plot(hours, solar_p50, 'b-', 'LineWidth', 2); hold on;
    fill([hours, fliplr(hours)], [solar_p10', fliplr(solar_p90')], ...
         'b', 'FaceAlpha', 0.2, 'EdgeColor', 'none');
    xlabel('Hour');
    ylabel('Capacity Factor');
    title('Solar Generation Forecast (P10-P50-P90)');
    legend('P50', 'P10-P90 Interval', 'Location', 'best');
    grid on;
    ylim([0, 1]);
    
    % Wind forecast plot
    subplot(2, 2, 2);
    plot(hours, wind_p50, 'g-', 'LineWidth', 2); hold on;
    fill([hours, fliplr(hours)], [wind_p10', fliplr(wind_p90')], ...
         'g', 'FaceAlpha', 0.2, 'EdgeColor', 'none');
    xlabel('Hour');
    ylabel('Capacity Factor');
    title('Wind Generation Forecast (P10-P50-P90)');
    legend('P50', 'P10-P90 Interval', 'Location', 'best');
    grid on;
    ylim([0, 1]);
    
    % Total generation vs demand
    subplot(2, 2, 3);
    plot(hours, total_p50, 'b-', 'LineWidth', 2); hold on;
    plot(hours, ones(size(hours)) * demand, 'r--', 'LineWidth', 2);
    fill([hours, fliplr(hours)], [total_p10', fliplr(total_p90')], ...
         'b', 'FaceAlpha', 0.2, 'EdgeColor', 'none');
    xlabel('Hour');
    ylabel('Capacity Factor');
    title('Total Generation vs Demand');
    legend('Total Gen (P50)', 'Demand', 'P10-P90 Interval', 'Location', 'best');
    grid on;
    ylim([0, 2]);
    
    % Uncertainty quantification
    subplot(2, 2, 4);
    solar_uncertainty = solar_p90 - solar_p10;
    wind_uncertainty = wind_p90 - wind_p10;
    plot(hours, solar_uncertainty, 'b-', 'LineWidth', 2); hold on;
    plot(hours, wind_uncertainty, 'g-', 'LineWidth', 2);
    xlabel('Hour');
    ylabel('Uncertainty (P90-P10)');
    title('Forecast Uncertainty by Hour');
    legend('Solar', 'Wind', 'Location', 'best');
    grid on;
    
    saveas(gcf, 'quantile_forecast.png');
    fprintf('    Saved visualization to quantile_forecast.png\n\n');
    
    %% Export Results
    fprintf('[8] Exporting results to quantile_forecast.csv...\n');
    
    results_table = table(hours', solar_p10, solar_p50, solar_p90, ...
                          wind_p10, wind_p50, wind_p90, ...
                          total_p10, total_p50, total_p90, ...
                          'VariableNames', {'Hour', 'Solar_P10', 'Solar_P50', 'Solar_P90', ...
                                           'Wind_P10', 'Wind_P50', 'Wind_P90', ...
                                           'Total_P10', 'Total_P50', 'Total_P90'});
    
    writetable(results_table, 'quantile_forecast.csv');
    
    fprintf('\n========================================\n');
    fprintf('ANALYSIS COMPLETE\n');
    fprintf('========================================\n');
end

%% Generate Training Data
function [X, y_solar, y_wind] = generate_training_data(n_hours)
    hours = (0:n_hours-1)';
    hour_of_day = mod(hours, 24);
    day_of_year = floor(hours / 24);
    
    % Create feature matrix
    X = zeros(n_hours, 8);
    X(:, 1) = ones(n_hours, 1); % Intercept
    X(:, 2) = sin(2*pi*hour_of_day/24);
    X(:, 3) = cos(2*pi*hour_of_day/24);
    X(:, 4) = sin(4*pi*hour_of_day/24);
    X(:, 5) = cos(4*pi*hour_of_day/24);
    X(:, 6) = sin(2*pi*day_of_year/365);
    X(:, 7) = cos(2*pi*day_of_year/365);
    X(:, 8) = randn(n_hours, 1) * 0.1; % Weather noise
    
    % Generate solar capacity (0-1)
    solar_base = max(0, sin((hour_of_day - 6) * pi / 12)) * 0.8;
    solar_seasonal = 0.2 * sin(2*pi*day_of_year/365);
    y_solar = min(0.99, max(0.01, solar_base + solar_seasonal + randn(n_hours, 1) * 0.1));
    
    % Generate wind capacity (0-1)
    wind_base = 0.4 + 0.3 * sin(hour_of_day * pi / 6);
    wind_seasonal = 0.15 * cos(2*pi*day_of_year/365);
    y_wind = min(0.99, max(0.01, wind_base + wind_seasonal + randn(n_hours, 1) * 0.15));
end

%% Train Quantile Regression Model
function model = train_quantile_model(X, y, tau)
    % Linear programming approach to quantile regression
    n = size(X, 1);
    p = size(X, 2);
    
    % Check-loss function optimization
    % Minimize: tau * sum(max(y-Xb, 0)) + (1-tau) * sum(max(Xb-y, 0))
    
    % Using iteratively reweighted least squares (IRLS)
    beta = X \ y; % Initial OLS estimate
    
    for iter = 1:50
        residuals = y - X * beta;
        
        % Weights for asymmetric loss
        weights = tau * (residuals > 0) + (1 - tau) * (residuals <= 0);
        weights = max(weights, 1e-6);
        
        % Weighted least squares update
        W = diag(weights);
        beta = (X' * W * X) \ (X' * W * y);
    end
    
    model.beta = beta;
    model.tau = tau;
end

%% Predict Quantile
function y_pred = predict_quantile(X, model)
    y_pred = X * model.beta;
    y_pred = min(0.99, max(0.01, y_pred)); % Bound to (0, 1)
end

%% Generate Forecast Features
function X = generate_forecast_features(n_hours)
    current_hour = hour(datetime('now'));
    
    hours = (0:n_hours-1)';
    hour_of_day = mod(current_hour + hours, 24);
    day_of_year = repmat(datenum(datetime('now')) - datenum(datetime(year(datetime('now')), 1, 1)) + 1, n_hours, 1);
    
    X = zeros(n_hours, 8);
    X(:, 1) = ones(n_hours, 1);
    X(:, 2) = sin(2*pi*hour_of_day/24);
    X(:, 3) = cos(2*pi*hour_of_day/24);
    X(:, 4) = sin(4*pi*hour_of_day/24);
    X(:, 5) = cos(4*pi*hour_of_day/24);
    X(:, 6) = sin(2*pi*day_of_year/365);
    X(:, 7) = cos(2*pi*day_of_year/365);
    X(:, 8) = randn(n_hours, 1) * 0.05;
end
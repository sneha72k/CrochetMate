from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np

app = Flask(__name__)
CORS(app)

model = joblib.load('yarn_model.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        craft = 1 if data.get('craft') == 'knitting' else 0
        y_size = float(data.get('yarn_weight', 4))
        t_size = float(data.get('tool_size', 5.0))
        ratio = float(data.get('swatch_ratio', 0.01))
        p_sts = float(data.get('project_stitches', 0))

        features = pd.DataFrame([[craft, y_size, t_size, ratio, p_sts]], 
                                columns=['craft_type', 'ysize', 'tsize', 'ratio', 'psts'])
        
        # Main Prediction
        prediction = model.predict(features)[0]
        
        # Dynamic Confidence
        tree_preds = [tree.predict(features.values)[0] for tree in model.estimators_]
        deviation = np.std(tree_preds)
        
        # Confidence is high if trees agree
        confidence = max(60, 100 - (deviation / (prediction + 1) * 100))

        return jsonify({
            'status': 'success',
            'predicted_yarn': round(prediction, 2),
            'accuracy': round(confidence, 2)
        })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

if __name__ == '__main__':
    app.run(port=5000, debug=True)
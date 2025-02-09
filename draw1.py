from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import cv2
import numpy as np
import base64
import requests  # 替换 openai 为 requests
import os
from PIL import Image
import io
import json
import random

# 在文件开头添加这些代码
print("Current working directory:", os.getcwd())
print("Templates directory exists:", os.path.exists("templates"))
print("Index.html exists:", os.path.exists("templates/index.html"))

app = Flask(__name__, 
    template_folder=os.path.abspath('templates'),
    static_folder=os.path.abspath('static'))
CORS(app)

# Kimi API 配置
KIMI_API_KEY = "sk-AJoW1T5pnak3WJdWqmumqTrqQLaTDD3JoSwGxwoFzNEXnDnz"
KIMI_API_URL = "https://api.moonshot.cn/v1/chat/completions"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {KIMI_API_KEY}"
}

class StoryGenerator:
    def __init__(self):
        self.story_context = []
        self.current_scene = 0
        self.storytellers = [
            "昆仑山的云朵小仙",
            "月牙船上的玉兔仙子",
            "藏在《山海经》里的白泽神兽"
        ]
        self.current_storyteller = random.choice(self.storytellers)
        
    def start_new_story(self):
        self.story_context = []
        self.current_scene = 0
        self.current_storyteller = random.choice(self.storytellers)
        
        return f"""
        哈喽！我是{self.current_storyteller}！
        让我们一起画一个有趣的故事吧！
        你想画什么都可以哦，我会把它变成一个神奇的故事！
        准备好了吗？开始画吧！
        """

    def analyze_drawing(self, image_data):
        """使用 moonshot 模型分析画作内容"""
        try:
            # 检查和处理图片大小
            if len(image_data) > 1000000:  # 如果图片大于1MB
                # 压缩图片
                img_data = base64.b64decode(image_data.split(',')[1])
                img = Image.open(io.BytesIO(img_data))
                
                # 调整图片大小
                max_size = (800, 800)
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # 转换回base64
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=85)
                image_data = base64.b64encode(buffer.getvalue()).decode()

            # 如果图片数据包含 data:image/jpeg;base64, 前缀，需要移除
            if 'data:' in image_data:
                image_data = image_data.split(',')[1]

            # 使用 moonshot 模型进行图像识别
            payload = {
                "model": "moonshot-v1-8k-vision-preview",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "请详细描述这幅儿童画的内容，包括画中的人物、物体、场景和动作。"
                            },
                            {
                                "type": "image_url",
                                "image_url": f"data:image/jpeg;base64,{image_data}"
                            }
                        ]
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            }

            response = requests.post(KIMI_API_URL, headers=HEADERS, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            return result['choices'][0]['message']['content']
            
        except Exception as e:
            return f"分析图片时出错: {str(e)}"

    def generate_story_continuation(self, drawing_description):
        """使用 Kimi API 生成故事"""
        self.story_context.append(drawing_description)
        
        if self.current_scene == 0:
            prompt = f"""
            你是一个温暖友好的童话精灵，对中国传统文化和诗词非常了解。
            小朋友刚刚画了第一幅画，内容是：{drawing_description}

            请用简短的语言和小朋友互动：
            用2-3句话把画里的内容变成一个有趣的故事，要自然地融入一个传统文化元素（可以是诗句、神话人物或场景），
            用一句话称赞小朋友，
            用一个简单的诗意问题引导继续画画。

            要求：
            - 每句话都要简短
            - 像朋友一样自然地聊天
            - 不要说教
            - 保持童趣
            - 引导联想诗意场景
            """
        else:
            prompt = f"""
            你是一个温暖友好的童话精灵，对中国传统文化和诗词非常了解。

            之前的故事是：{' '.join(self.story_context[:-1])}
            小朋友现在又画了新的内容：{drawing_description}

            请用简短的语言继续和小朋友聊天：
            用2-3句话把新画的内容接到故事里，要自然地融入一个传统文化元素，
            用一句话夸夸小朋友，
            用一个简单的诗意问题引导继续。

            要求：
            - 每句话都要简短
            - 像朋友一样自然地聊天
            - 不要说教
            - 保持童趣
            - 引导联想诗意场景
            """

        try:
            payload = {
                "model": "moonshot-v1-32k",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.8,
                "max_tokens": 500,
                "top_p": 0.9
            }

            response = requests.post(KIMI_API_URL, headers=HEADERS, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            story_continuation = result['choices'][0]['message']['content']
            
            self.current_scene += 1
            return story_continuation
            
        except Exception as e:
            print(f"生成故事时出错: {str(e)}")
            return f"生成故事时出错: {str(e)}"

    def check_story_ending(self):
        if self.current_scene >= 5:
            return """
            哇！我们已经创造了一个超棒的故事！
            
            你想要：
            - 继续画更多有趣的内容
            - 给故事一个完美的结局
            - 开始一个新的故事
            
            你来选择吧！
            """
        return None

story_generator = StoryGenerator()

@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        return f"Error loading template: {str(e)}"

@app.route('/process_drawing', methods=['POST'])
def process_drawing():
    try:
        image_data = request.json['image']
        action = request.json.get('action', 'continue')
        
        if action == 'new_story':
            welcome_message = story_generator.start_new_story()
            return jsonify({
                'status': 'success',
                'message': welcome_message
            })
        
        # 使用 moonshot 模型分析画作
        drawing_analysis = story_generator.analyze_drawing(image_data)
        if "错误" in drawing_analysis:
            return jsonify({
                'status': 'error',
                'message': drawing_analysis
            })
        
        # 使用 Kimi API 生成故事
        story_continuation = story_generator.generate_story_continuation(drawing_analysis)
        ending_prompt = story_generator.check_story_ending()
        
        # 只返回故事内容，不返回分析结果
        return jsonify({
            'status': 'success',
            'story': story_continuation,
            'ending_prompt': ending_prompt,
            'scene_count': story_generator.current_scene,
            'storyteller': story_generator.current_storyteller
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"处理请求时出错: {str(e)}"
        })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
